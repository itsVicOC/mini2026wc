export function toDisplayStatus(status: string) {
  switch (status) {
    case 'SCHEDULED':
    case 'TIMED':
      return '未开始';
    case 'IN_PLAY':
    case 'LIVE':
      return '进行中';
    case 'PAUSED':
      return '中场';
    case 'FINISHED':
      return '已结束';
    case 'POSTPONED':
      return '延期';
    case 'SUSPENDED':
      return '中断';
    case 'CANCELLED':
      return '取消';
    default:
      return status || '未知';
  }
}

export function isFinished(status: string) {
  return status === 'FINISHED';
}

export function isLive(status: string) {
  return ['IN_PLAY', 'LIVE', 'PAUSED'].includes(status);
}

export function isNotStartedOrPending(status: string) {
  return ['SCHEDULED', 'TIMED', 'POSTPONED', 'SUSPENDED', 'CANCELLED'].includes(status);
}

