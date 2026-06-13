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
    lastSyncText: '',
    refreshing: false
  },

  onLoad() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData({ refresh: true }).finally(() => wx.stopPullDownRefresh());
  },

  onShareAppMessage() {
    return {
      title: '苏式生活馆｜2026 世界杯赛事伴侣',
      path: '/pages/home/home'
    };
  },

  onShareTimeline() {
    return {
      title: '苏式生活馆｜2026 世界杯赛事伴侣'
    };
  },

  onRefreshTap() {
    if (this.data.refreshing) {
      return;
    }
    this.loadData({ refresh: true, manual: true });
  },

  async loadData(options = {}) {
    this.setData({
      loading: !options.manual,
      refreshing: Boolean(options.manual),
      error: ''
    });
    try {
      const data = await api.getHome({ refresh: options.refresh });
      this.setData({
        progress: data.progress || this.data.progress,
        todayMatches: this.decorateMatches(data.todayMatches || []),
        weekMatches: (data.weekMatches || []).map((group) => ({
          ...group,
          matches: this.decorateMatches(group.matches || [])
        })),
        lastSyncText: this.lastSyncText(data.lastSync || []),
        loading: false,
        refreshing: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        refreshing: false,
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
    return latest ? `最近更新 ${formatBeijingDateTime(latest)}` : '等待首次同步';
  }
});

function formatBeijingDateTime(value) {
  const date = parseDate(value);
  if (!date) {
    return value;
  }
  const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const pad = (number) => String(number).padStart(2, '0');
  return `${beijingDate.getUTCFullYear()}-${pad(beijingDate.getUTCMonth() + 1)}-${pad(beijingDate.getUTCDate())} ${pad(beijingDate.getUTCHours())}:${pad(beijingDate.getUTCMinutes())}`;
}

function parseDate(value) {
  if (!value) {
    return null;
  }
  const text = String(value).trim();
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const date = new Date(`${normalized}${/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized) ? '' : 'Z'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}
