function scoreText(match) {
  if (!match || !match.score || match.score.home === null || match.score.away === null) {
    return '-';
  }
  return `${match.score.home} : ${match.score.away}`;
}

function teamName(team) {
  return (team && team.name) || '待定';
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
