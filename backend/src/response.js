function sendData(res, data, meta = {}) {
  res.json({ data, meta });
}

function sendCreated(res, data, meta = {}) {
  res.status(201).json({ data, meta });
}

function sendPaged(res, result) {
  res.json({
    data: result.items,
    meta: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages
    }
  });
}

module.exports = {
  sendData,
  sendCreated,
  sendPaged
};
