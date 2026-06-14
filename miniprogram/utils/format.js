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
  const text = String(group).replace('GROUP_', '').replace('GROUP ', '').trim();
  return `${text}组`;
}

module.exports = {
  scoreText,
  teamName,
  groupLabel
};
