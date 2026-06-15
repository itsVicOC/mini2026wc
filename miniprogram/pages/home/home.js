const api = require('../../services/api');
const { scoreText, teamName } = require('../../utils/format');
const {
  canSubscribeMatch,
  decorateSubscriptionState,
  isSubscriptionEnabled,
  login,
  requestSubscribePermission
} = require('../../utils/subscribe');

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
    refreshing: false,
    subscribingMatchId: null,
    subscribedMatchIds: []
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
      this.loadSubscriptionStatus();
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
      ...decorateSubscriptionState(match, this.data.subscribedMatchIds, this.data.subscribingMatchId),
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
  },

  async onSubscribeTap(event) {
    const apiMatchId = Number(event.currentTarget.dataset.matchId);
    if (!apiMatchId || this.data.subscribingMatchId || this.data.subscribedMatchIds.indexOf(apiMatchId) >= 0) {
      return;
    }
    const match = this.findMatchByApiMatchId(apiMatchId);
    if (!match || !canSubscribeMatch(match)) {
      this.refreshSubscriptionState();
      wx.showToast({ title: '当前比赛已不支持订阅', icon: 'none' });
      return;
    }
    this.setData({ subscribingMatchId: apiMatchId });
    this.refreshSubscriptionState();

    try {
      await requestSubscribePermission();
      const code = await login();
      await api.subscribeMatch({
        code,
        apiMatchId,
        expectedUtcDate: match.utcDate,
        expectedMatchName: this.matchName(match)
      });
      const subscribedMatchIds = Array.from(new Set([...this.data.subscribedMatchIds, apiMatchId]));
      this.setData({ subscribedMatchIds, subscribingMatchId: null });
      this.refreshSubscriptionState();
      wx.showToast({ title: '订阅成功', icon: 'success' });
    } catch (error) {
      this.setData({ subscribingMatchId: null });
      this.refreshSubscriptionState();
      wx.showToast({
        title: error.message || '订阅失败',
        icon: 'none'
      });
    }
  },

  async loadSubscriptionStatus() {
    if (!isSubscriptionEnabled()) {
      return;
    }
    const matchIds = this.collectSubscribableMatchIds();
    if (matchIds.length === 0) {
      return;
    }

    try {
      const code = await login();
      const result = await api.getMatchSubscriptionStatus({
        code,
        matchIds: matchIds.join(',')
      });
      this.setData({
        subscribedMatchIds: result.subscribedMatchIds || []
      });
      this.refreshSubscriptionState();
    } catch (error) {
      console.warn('[subscription status failed]', error);
    }
  },

  refreshSubscriptionState() {
    this.setData({
      todayMatches: this.decorateMatches(this.data.todayMatches),
      weekMatches: this.data.weekMatches.map((group) => ({
        ...group,
        matches: this.decorateMatches(group.matches || [])
      }))
    });
  },

  collectSubscribableMatchIds() {
    const matches = [
      ...this.data.todayMatches,
      ...this.data.weekMatches.reduce((result, group) => result.concat(group.matches || []), [])
    ];
    return matches
      .filter((match) => ['SCHEDULED', 'TIMED'].indexOf(match.status) >= 0)
      .map((match) => match.apiMatchId);
  },

  findMatchByApiMatchId(apiMatchId) {
    const matches = [
      ...this.data.todayMatches,
      ...this.data.weekMatches.reduce((result, group) => result.concat(group.matches || []), [])
    ];
    return matches.find((match) => match.apiMatchId === apiMatchId);
  },

  matchName(match) {
    return `${match.homeName || teamName(match.homeTeam)} vs ${match.awayName || teamName(match.awayTeam)}`;
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
