const api = require('../../services/api');
const { groupLabel, scoreText, stageLabel, teamName } = require('../../utils/format');
const {
  decorateSubscriptionState,
  isSubscriptionEnabled,
  login,
  requestSubscribePermission
} = require('../../utils/subscribe');

Page({
  data: {
    loading: true,
    error: '',
    subscribingMatchId: null,
    subscribedMatchIds: [],
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

  onShareAppMessage() {
    return {
      title: '2026 世界杯赛程',
      path: '/pages/matches/matches'
    };
  },

  onShareTimeline() {
    return {
      title: '2026 世界杯赛程'
    };
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
          stageText: stageLabel(match.stage),
          groupText: match.group ? groupLabel(match.group) : ''
        })),
        loading: false
      });
      this.applyStatus(this.data.activeStatus);
      this.loadSubscriptionStatus();
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
      matches: matches.map((match) =>
        decorateSubscriptionState(match, this.data.subscribedMatchIds, this.data.subscribingMatchId)
      ),
      showEmpty: matches.length === 0,
      statuses: this.data.statuses.map((status) => ({
        ...status,
        className: status.value === activeStatus ? 'filter active' : 'filter'
      }))
    });
  },

  async onSubscribeTap(event) {
    const apiMatchId = Number(event.currentTarget.dataset.matchId);
    const match = this.data.allMatches.find((item) => item.apiMatchId === apiMatchId);
    if (!match || this.data.subscribingMatchId || this.data.subscribedMatchIds.indexOf(apiMatchId) >= 0) {
      return;
    }

    this.setData({ subscribingMatchId: apiMatchId });
    this.applyStatus(this.data.activeStatus);

    try {
      await requestSubscribePermission();
      const code = await login();
      await api.subscribeMatch({ code, apiMatchId });
      const subscribedMatchIds = Array.from(new Set([...this.data.subscribedMatchIds, apiMatchId]));
      this.setData({ subscribedMatchIds, subscribingMatchId: null });
      this.applyStatus(this.data.activeStatus);
      wx.showToast({ title: '订阅成功', icon: 'success' });
    } catch (error) {
      this.setData({ subscribingMatchId: null });
      this.applyStatus(this.data.activeStatus);
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
    const matchIds = this.data.allMatches
      .filter((match) => match.canSubscribe || ['SCHEDULED', 'TIMED'].indexOf(match.status) >= 0)
      .map((match) => match.apiMatchId);
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
      this.applyStatus(this.data.activeStatus);
    } catch (error) {
      console.warn('[subscription status failed]', error);
    }
  }
});
