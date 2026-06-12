const api = require('../../services/api');
const { scoreText, teamName } = require('../../utils/format');

Page({
  data: {
    loading: true,
    error: '',
    activeStatus: '',
    statuses: [
      { label: '全部', value: '', className: 'filter active' },
      { label: '未开始', value: 'PENDING' },
      { label: '进行中', value: 'LIVE' },
      { label: '已结束', value: 'FINISHED' }
    ],
    allMatches: [],
    matches: [],
    showEmpty: false
  },

  onLoad() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  onStatusTap(event) {
    this.applyStatus(event.currentTarget.dataset.value || '');
  },

  async loadData() {
    this.setData({ loading: true, error: '' });
    try {
      const matches = await api.getMatches();
      this.setData({
        allMatches: matches.map((match) => ({
          ...match,
          scoreText: scoreText(match),
          homeName: teamName(match.homeTeam),
          awayName: teamName(match.awayTeam),
          stageText: match.stage || '待定阶段',
          groupText: match.group || ''
        })),
        loading: false
      });
      this.applyStatus(this.data.activeStatus);
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '赛程加载失败'
      });
    }
  },

  applyStatus(activeStatus) {
    const matches = this.data.allMatches.filter((match) => {
      if (!activeStatus) {
        return true;
      }
      if (activeStatus === 'PENDING') {
        return ['SCHEDULED', 'TIMED', 'POSTPONED', 'SUSPENDED', 'CANCELLED'].indexOf(match.status) >= 0;
      }
      if (activeStatus === 'LIVE') {
        return ['IN_PLAY', 'LIVE', 'PAUSED'].indexOf(match.status) >= 0;
      }
      return match.status === activeStatus;
    });

    this.setData({
      activeStatus,
      matches,
      showEmpty: matches.length === 0,
      statuses: this.data.statuses.map((status) => ({
        ...status,
        className: status.value === activeStatus ? 'filter active' : 'filter'
      }))
    });
  }
});
