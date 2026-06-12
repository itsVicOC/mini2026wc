const api = require('../../services/api');
const { scoreText, teamName } = require('../../utils/format');

Page({
  data: {
    loading: true,
    error: '',
    progress: {
      total: 104,
      finished: 0,
      pending: 104,
      live: 0,
      progressPercent: 0
    },
    todayMatches: [],
    weekMatches: [],
    lastSyncText: ''
  },

  onLoad() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    this.setData({ loading: true, error: '' });
    try {
      const data = await api.getHome();
      this.setData({
        progress: data.progress || this.data.progress,
        todayMatches: this.decorateMatches(data.todayMatches || []),
        weekMatches: (data.weekMatches || []).map((group) => ({
          ...group,
          matches: this.decorateMatches(group.matches || [])
        })),
        lastSyncText: this.lastSyncText(data.lastSync || []),
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '数据加载失败'
      });
    }
  },

  decorateMatches(matches) {
    return matches.map((match) => ({
      ...match,
      scoreText: scoreText(match),
      homeName: teamName(match.homeTeam),
      awayName: teamName(match.awayTeam)
    }));
  },

  lastSyncText(syncs) {
    const latest = syncs
      .map((sync) => sync.finished_at)
      .filter(Boolean)
      .sort()
      .pop();
    return latest ? `最近更新 ${latest}` : '等待首次同步';
  }
});

