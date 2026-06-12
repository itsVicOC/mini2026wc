const api = require('../../services/api');
const { groupLabel } = require('../../utils/format');

Page({
  data: {
    loading: true,
    error: '',
    activeGroup: 'GROUP_A',
    groups: buildFixedGroups('GROUP_A'),
    allStandings: [],
    standings: [],
    showEmpty: false
  },

  onLoad() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  onGroupTap(event) {
    this.applyGroup(event.currentTarget.dataset.value);
  },

  async loadData() {
    this.setData({ loading: true, error: '' });
    try {
      const allStandings = await api.getStandings();
      console.info('[standings loaded]', {
        count: allStandings.length,
        groups: uniqueGroups(allStandings)
      });

      this.setData({
        allStandings,
        loading: false
      });
      this.applyGroup(this.data.activeGroup);
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '积分榜加载失败'
      });
    }
  },

  applyGroup(activeGroup) {
    const activeMeta = this.data.groups.find((group) => group.value === activeGroup);
    const activeKey = activeMeta ? activeMeta.key : groupKey(activeGroup);
    const standings = this.data.allStandings.filter((row) => groupKey(row.group) === activeKey);
    this.setData({
      activeGroup,
      groups: this.data.groups.map((group) => ({
        ...group,
        className: group.value === activeGroup ? 'group-tab active' : 'group-tab'
      })),
      standings: standings.map((row) => ({
        ...row,
        key: `${row.group}-${row.team.apiTeamId || row.team.name}`,
        groupText: groupLabel(row.group),
        rankClass: row.position <= 2 ? 'qualified' : ''
      })),
      showEmpty: standings.length === 0
    });
  }
});

function buildFixedGroups(activeGroup) {
  return Array.from({ length: 12 }).map((_, index) => {
    const letter = String.fromCharCode(65 + index);
    const value = `GROUP_${letter}`;
    return {
      label: groupLabel(value),
      value,
      key: letter,
      className: value === activeGroup ? 'group-tab active' : 'group-tab'
    };
  });
}

function groupKey(group) {
  const text = String(group || '').toUpperCase().replace(/_/g, ' ').trim();
  const match = text.match(/([A-L])$/);
  return match ? match[1] : text;
}

function uniqueGroups(standings) {
  const seen = {};
  return standings
    .map((row) => row.group)
    .filter((group) => {
      if (!group || seen[group]) {
        return false;
      }
      seen[group] = true;
      return true;
    });
}
