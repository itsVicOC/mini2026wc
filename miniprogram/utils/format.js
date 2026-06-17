const { getChineseTeamName } = require('./teamNames');

function scoreText(match) {
  if (!match || !match.score || match.score.home === null || match.score.away === null) {
    return '-';
  }
  return `${match.score.home} : ${match.score.away}`;
}

function teamName(team) {
  return getChineseTeamName(team) || (team && (team.name || team.shortName || team.tla)) || '待定';
}

function groupLabel(group) {
  if (!group) {
    return '未分组';
  }
  const normalized = String(group).trim().toUpperCase();
  if (normalized === 'GROUP_STAGE') {
    return '小组赛';
  }
  if (normalized === 'GROUP_UNKNOWN' || normalized === 'UNKNOWN') {
    return '未分组';
  }
  const match = normalized.match(/^(?:GROUP[_\s-]?)?([A-L])$/);
  return match ? `${match[1]} 组` : String(group);
}

function stageLabel(stage) {
  const map = {
    GROUP_STAGE: '小组赛',
    LAST_32: '32 强',
    ROUND_OF_32: '32 强',
    LAST_16: '16 强',
    ROUND_OF_16: '16 强',
    QUARTER_FINALS: '8 强',
    QUARTER_FINAL: '8 强',
    QUARTERFINALS: '8 强',
    SEMI_FINALS: '半决赛',
    SEMI_FINAL: '半决赛',
    SEMIFINALS: '半决赛',
    THIRD_PLACE: '三四名决赛',
    THIRD_PLACE_PLAYOFF: '三四名决赛',
    FINAL: '决赛'
  };
  if (!stage) {
    return '待定阶段';
  }
  const normalized = String(stage).trim().toUpperCase();
  return map[normalized] || String(stage);
}

function canViewMatchDetail(match) {
  return Boolean(match && ['IN_PLAY', 'LIVE', 'PAUSED', 'FINISHED'].indexOf(match.status) >= 0);
}

function openTeamDetail(apiTeamId) {
  const id = Number(apiTeamId);
  if (!id) {
    return false;
  }
  wx.navigateTo({
    url: `/pages/team-detail/team-detail?apiTeamId=${id}`
  });
  return true;
}

module.exports = {
  scoreText,
  teamName,
  groupLabel,
  stageLabel,
  canViewMatchDetail,
  openTeamDetail
};
