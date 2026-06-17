const api = require('../../services/api');
const { openTeamDetail, teamName } = require('../../utils/format');

Page({
  data: {
    loading: true,
    error: '',
    scorers: [],
    showEmpty: false
  },

  onLoad() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  onShareAppMessage() {
    return {
      title: '2026 世界杯射手榜',
      path: '/pages/scorers/scorers'
    };
  },

  onShareTimeline() {
    return {
      title: '2026 世界杯射手榜'
    };
  },

  async loadData() {
    this.setData({ loading: true, error: '' });
    try {
      const scorers = await api.getScorers(30);
      this.setData({
        scorers: scorers.map((scorer, index) => ({
          ...scorer,
          rank: scorer.rank || index + 1,
          rankClass: (scorer.rank || index + 1) <= 3 ? 'top' : '',
          teamText: teamName(scorer.team),
          assistsText: scorer.assists === null || scorer.assists === undefined ? '-' : scorer.assists
        })),
        showEmpty: scorers.length === 0,
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '射手榜加载失败'
      });
    }
  },

  onTeamTap(event) {
    openTeamDetail(event.currentTarget.dataset.teamId);
  }
});
