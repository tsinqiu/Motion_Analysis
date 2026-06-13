import {
  Activity,
  Bike,
  CalendarDays,
  Dumbbell,
  Flame,
  HeartPulse,
  Moon,
  ShieldCheck,
  Waves,
  Zap,
} from '@lucide/vue'

export const sportFilters = [
  { label: '全部', value: 'all', color: '#21d47b' },
  { label: '跑步', value: 'running', color: '#21d47b' },
  { label: '骑行', value: 'cycling', color: '#ff9d19' },
  { label: '游泳', value: 'swimming', color: '#33b5ff' },
  { label: '力量', value: 'strength_training', color: '#8b5cf6' },
  { label: '其他', value: 'other', color: '#94a3b8' },
]

export const weather = {
  city: '滨湖, 江苏省',
  condition: '阴',
  temperature: 21,
  feelsLike: 20,
  aqi: 28,
  wind: '东北风 3 级',
  suggestion: '天气适宜，适合户外运动',
}

export const todayPlan = {
  title: '今日无训练安排',
  description: '建议做 20 分钟拉伸或轻松恢复跑，保持训练节奏。',
  nextWorkout: '轻松跑 8 km',
  pace: '5:00 - 5:30 /km',
  heartRateZone: '二区',
  duration: '45 分钟',
}

export const healthMetrics = [
  { label: '静息心率', value: '44', unit: 'bpm', icon: HeartPulse, trend: '较昨日 -2', status: '正常', progress: 42 },
  { label: 'HRV 状态', value: 'Unbalanced', unit: '', icon: Activity, trend: '需要恢复', status: '偏低', progress: 52 },
  { label: '身体电量', value: '79', unit: '%', icon: Zap, trend: '+12%', status: '良好', progress: 79 },
  { label: '睡眠分数', value: '68', unit: '', icon: Moon, trend: '一般', status: '可改善', progress: 68 },
  { label: 'VO2 Max 跑步', value: '64.0', unit: '', icon: ShieldCheck, trend: '优秀', status: '高水平', progress: 88 },
  { label: '乳酸阈值心率', value: '184', unit: 'bpm', icon: HeartPulse, trend: '阈值配速 3:41/km', status: '稳定', progress: 84 },
  { label: '步数', value: '1,166', unit: 'steps', icon: Activity, trend: '今日累计', status: '偏少', progress: 24 },
  { label: '卡路里', value: '526', unit: 'kcal', icon: Flame, trend: '活动消耗', status: '进行中', progress: 46 },
]

export const syncProviders = [
  { name: 'Garmin Connect', status: '已连接', direction: '导入', count: 138, auto: true, lastSync: '2026-06-10 22:18' },
  { name: 'Strava', status: '待授权', direction: '双向', count: 0, auto: false, lastSync: '--' },
  { name: 'COROS', status: '待授权', direction: '导入', count: 0, auto: false, lastSync: '--' },
  { name: 'Apple Health', status: '本地模拟', direction: '导入', count: 12, auto: false, lastSync: '2026-06-08 08:10' },
  { name: 'Keep', status: '待授权', direction: '导入', count: 0, auto: false, lastSync: '--' },
]

export const exploreArticles = [
  { title: '半程马拉松赛前 4 周训练节奏', category: '跑步训练', readTime: '6 min', level: '进阶' },
  { title: '骑行 FTP 测试前后的恢复安排', category: '骑行训练', readTime: '5 min', level: '专业' },
  { title: 'HRV 下降时是否应该降强度', category: '恢复与健康', readTime: '4 min', level: '基础' },
  { title: '力量训练如何辅助跑步经济性', category: '力量训练', readTime: '7 min', level: '进阶' },
]

export const communityPosts = [
  { id: 'post-run-001', user: 'Runner A', type: '跑步', text: '晨跑完成，后半程心率控制得更稳。', distance: '10.24 km', duration: '47:48', pace: '4:40 /km', likes: 32 },
  { id: 'post-ride-001', user: 'Cyclist B', type: '骑行', text: '太湖绿道风有点大，功率输出还算平滑。', distance: '72.98 km', duration: '2:30:38', pace: '29.1 km/h', likes: 45 },
  { id: 'post-swim-001', user: 'Swimmer C', type: '游泳', text: '今天重点练划水效率，配速比上周稳定。', distance: '1.5 km', duration: '39:40', pace: '2:38 /100m', likes: 18 },
]

export const startSportTypes = [
  { label: '户外跑步', type: 'running', icon: Activity, color: '#21d47b' },
  { label: '室内跑步', type: 'running', icon: Activity, color: '#21d47b' },
  { label: '户外骑行', type: 'cycling', icon: Bike, color: '#ff9d19' },
  { label: '室内骑行', type: 'cycling', icon: Bike, color: '#ff9d19' },
  { label: '游泳', type: 'swimming', icon: Waves, color: '#33b5ff' },
  { label: '力量训练', type: 'strength_training', icon: Dumbbell, color: '#8b5cf6' },
  { label: '步行', type: 'walking', icon: Activity, color: '#94a3b8' },
  { label: '其他', type: 'other', icon: CalendarDays, color: '#94a3b8' },
]

export const userSettings = {
  distanceUnit: '公里',
  weightUnit: 'kg',
  temperatureUnit: '℃',
  paceUnit: 'min/km',
  defaultPrivacy: '私密',
  hideMapEndpoints: true,
  healthSync: true,
}
