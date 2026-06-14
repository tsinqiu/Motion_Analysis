<template>
  <section class="panel route-panel">
    <div class="panel-heading">
      <div>
        <p class="overline">TrackPoints</p>
        <h2>地图轨迹预览</h2>
      </div>
      <span>{{ validPoints.length }} 点</span>
    </div>

    <div v-if="validPoints.length" ref="mapRef" class="route-map" aria-label="轨迹地图预览"></div>
    <div v-else class="route-map route-map-empty" aria-label="轨迹地图预览为空">
      <strong>暂无可用地图轨迹</strong>
      <span>当前运动没有有效经纬度采样点。</span>
    </div>
  </section>
</template>

<script setup>
import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  points: {
    type: Array,
    default: () => [],
  },
})

const mapRef = ref(null)
let map = null
let tileLayer = null
let routeLayer = null
let markerLayer = null

const EARTH_RADIUS_M = 6371000
const FALLBACK_ROUTE_COLOR = '#21d47b'
const SPEED_COLOR_STOPS = [
  { at: 0, color: [37, 99, 235] },
  { at: 0.25, color: [6, 182, 212] },
  { at: 0.5, color: [34, 197, 94] },
  { at: 0.75, color: [245, 158, 11] },
  { at: 1, color: [239, 68, 68] },
]

function toCoordinate(value) {
  if (value === null || value === undefined || value === '') return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function toDistance(value) {
  if (value === null || value === undefined || value === '') return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null
}

function toPositiveNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null
}

function toTimestamp(value) {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function toRadians(value) {
  return (value * Math.PI) / 180
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function interpolateColor(from, to, ratio) {
  const safeRatio = clamp(ratio, 0, 1)
  const [r, g, b] = from.map((value, index) =>
    Math.round(value + (to[index] - value) * safeRatio),
  )
  return `rgb(${r}, ${g}, ${b})`
}

function colorFromStops(ratio) {
  const safeRatio = clamp(ratio, 0, 1)
  const upperIndex = SPEED_COLOR_STOPS.findIndex((stop) => stop.at >= safeRatio)
  if (upperIndex <= 0) {
    return interpolateColor(SPEED_COLOR_STOPS[0].color, SPEED_COLOR_STOPS[0].color, 0)
  }

  const lower = SPEED_COLOR_STOPS[upperIndex - 1]
  const upper = SPEED_COLOR_STOPS[upperIndex]
  const span = upper.at - lower.at
  const localRatio = span > 0 ? (safeRatio - lower.at) / span : 0
  return interpolateColor(lower.color, upper.color, localRatio)
}

function quantile(values, ratio) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = (sorted.length - 1) * clamp(ratio, 0, 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]

  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

function colorForSpeed(speedMps, minSpeedMps, maxSpeedMps) {
  if (!Number.isFinite(speedMps) || speedMps <= 0) return FALLBACK_ROUTE_COLOR
  if (!Number.isFinite(minSpeedMps) || !Number.isFinite(maxSpeedMps)) return FALLBACK_ROUTE_COLOR

  const span = maxSpeedMps - minSpeedMps
  const ratio = span > 0 ? (speedMps - minSpeedMps) / span : 0.5
  return colorFromStops(ratio)
}

function distanceBetween(a, b) {
  const dLat = toRadians(b.latitude - a.latitude)
  const dLon = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

function interpolatePoint(before, after, targetDistanceM) {
  const span = after.distanceM - before.distanceM
  if (span <= 0) {
    return { latitude: after.latitude, longitude: after.longitude }
  }

  const ratio = Math.min(Math.max((targetDistanceM - before.distanceM) / span, 0), 1)
  return {
    latitude: before.latitude + (after.latitude - before.latitude) * ratio,
    longitude: before.longitude + (after.longitude - before.longitude) * ratio,
  }
}

const validPoints = computed(() =>
  props.points
    .map((point) => {
      const latitude = toCoordinate(point.latitude)
      const longitude = toCoordinate(point.longitude)
      const sourceDistanceM = toDistance(point.distance_m ?? point.distanceM)
      const speedMps = toPositiveNumber(point.speed_mps ?? point.speedMps)
      const timestampMs = toTimestamp(point.sample_time_utc ?? point.sampleTimeUtc)
      return { latitude, longitude, sourceDistanceM, speedMps, timestampMs }
    })
    .filter((point) =>
      point.latitude !== null
      && point.longitude !== null
      && point.latitude >= -90
      && point.latitude <= 90
      && point.longitude >= -180
      && point.longitude <= 180
    )
    .reduce((points, point, index) => {
      const previous = points.at(-1)
      const segmentDistanceM = previous
        ? distanceBetween(previous, point)
        : 0
      const fallbackDistanceM = previous
        ? previous.distanceM + segmentDistanceM
        : 0
      const previousDistanceM = previous?.distanceM ?? 0
      const distanceM = point.sourceDistanceM !== null && point.sourceDistanceM >= previousDistanceM
        ? point.sourceDistanceM
        : fallbackDistanceM

      points.push({
        latitude: point.latitude,
        longitude: point.longitude,
        distanceM: index === 0 ? 0 : distanceM,
        speedMps: point.speedMps,
        timestampMs: point.timestampMs,
      })
      return points
    }, []),
)

const latLngs = computed(() => validPoints.value.map((point) => [point.latitude, point.longitude]))

const routeSegments = computed(() => {
  if (validPoints.value.length < 2) return []

  const segments = validPoints.value.slice(1).map((point, index) => {
    const previous = validPoints.value[index]
    const segmentDistanceM = Math.max(point.distanceM - previous.distanceM, 0)
    const segmentDurationS = point.timestampMs && previous.timestampMs
      ? (point.timestampMs - previous.timestampMs) / 1000
      : null
    const fallbackSpeedMps = segmentDurationS && segmentDurationS > 0
      ? segmentDistanceM / segmentDurationS
      : null
    const speedMps = point.speedMps ?? previous.speedMps ?? fallbackSpeedMps

    return {
      latLngs: [
        [previous.latitude, previous.longitude],
        [point.latitude, point.longitude],
      ],
      speedMps,
    }
  })

  const speeds = segments.map((segment) => segment.speedMps).filter((speed) =>
    Number.isFinite(speed) && speed > 0
  )
  const minSpeedMps = quantile(speeds, 0.05)
  const maxSpeedMps = quantile(speeds, 0.95)

  return segments.map((segment) => ({
    ...segment,
    color: colorForSpeed(segment.speedMps, minSpeedMps, maxSpeedMps),
  }))
})

const kilometerMarkers = computed(() => {
  if (validPoints.value.length < 2) return []

  const firstDistanceM = validPoints.value[0].distanceM
  const lastDistanceM = validPoints.value.at(-1).distanceM
  const totalDistanceM = lastDistanceM - firstDistanceM
  const markerCount = Math.floor(totalDistanceM / 1000)
  if (markerCount < 1) return []

  const markers = []
  let segmentIndex = 1

  for (let kilometer = 1; kilometer <= markerCount; kilometer += 1) {
    const targetDistanceM = firstDistanceM + kilometer * 1000
    while (
      segmentIndex < validPoints.value.length - 1
      && validPoints.value[segmentIndex].distanceM < targetDistanceM
    ) {
      segmentIndex += 1
    }

    const before = validPoints.value[Math.max(segmentIndex - 1, 0)]
    const after = validPoints.value[segmentIndex]
    if (!before || !after || after.distanceM < targetDistanceM) continue

    markers.push({
      kilometer,
      ...interpolatePoint(before, after, targetDistanceM),
    })
  }

  return markers
})

function createEndpointIcon(label, tone) {
  return L.divIcon({
    className: `route-endpoint route-endpoint-${tone}`,
    html: `<span>${label}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function createKilometerIcon(kilometer) {
  const label = String(kilometer)
  const size = label.length >= 3 ? 18 : 14
  return L.divIcon({
    className: 'route-km-marker',
    html: `<span>${label}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function ensureMap() {
  if (!mapRef.value || map) return

  map = L.map(mapRef.value, {
    attributionControl: true,
    scrollWheelZoom: true,
    zoomControl: true,
  })

  tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)
}

function clearLayers() {
  if (routeLayer) {
    routeLayer.remove()
    routeLayer = null
  }
  if (markerLayer) {
    markerLayer.remove()
    markerLayer = null
  }
}

function destroyMap() {
  clearLayers()
  tileLayer?.remove()
  tileLayer = null
  map?.remove()
  map = null
}

function renderRoute() {
  if (!map || !latLngs.value.length) return

  clearLayers()

  routeLayer = L.layerGroup(
    routeSegments.value.map((segment) =>
      L.polyline(segment.latLngs, {
        color: segment.color,
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }),
    ),
  ).addTo(map)

  const markers = []
  const start = latLngs.value[0]
  const end = latLngs.value.at(-1)
  markers.push(L.marker(start, { icon: createEndpointIcon('起', 'start'), keyboard: false }))
  for (const marker of kilometerMarkers.value) {
    markers.push(L.marker(
      [marker.latitude, marker.longitude],
      {
        icon: createKilometerIcon(marker.kilometer),
        keyboard: false,
        title: `${marker.kilometer} km`,
        zIndexOffset: 300,
      },
    ))
  }
  if (end && (end[0] !== start[0] || end[1] !== start[1])) {
    markers.push(L.marker(end, { icon: createEndpointIcon('终', 'finish'), keyboard: false }))
  }
  markerLayer = L.layerGroup(markers).addTo(map)

  const bounds = L.latLngBounds(latLngs.value)
  map.fitBounds(bounds, {
    padding: [28, 28],
    maxZoom: 17,
  })
  map.invalidateSize()
}

async function refreshMap() {
  if (!validPoints.value.length) {
    destroyMap()
    return
  }

  await nextTick()
  ensureMap()
  renderRoute()
}

onMounted(refreshMap)

watch(() => props.points, refreshMap, { deep: true })

onBeforeUnmount(() => {
  destroyMap()
})
</script>
