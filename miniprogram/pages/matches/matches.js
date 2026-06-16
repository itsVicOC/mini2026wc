const api = require('../../services/api');
const { canViewMatchDetail, groupLabel, scoreText, stageLabel, teamName } = require('../../utils/format');
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
          groupText: match.group ? groupLabel(match.group) : '',
          canViewDetail: canViewMatchDetail(match)
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
    if (!match || this.data.subscribingMatchId) {
      return;
    }
    if (this.data.subscribedMatchIds.indexOf(apiMatchId) >= 0) {
      this.cancelSubscription(match);
      return;
    }
    if (!canSubscribeMatch(match)) {
      this.applyStatus(this.data.activeStatus);
      wx.showToast({ title: '当前比赛已不支持订阅', icon: 'none' });
      return;
    }
    this.setData({ subscribingMatchId: apiMatchId });
    this.applyStatus(this.data.activeStatus);

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

  async cancelSubscription(match) {
    const confirmed = await confirmCancelSubscription(this.matchName(match));
    if (!confirmed) {
      return;
    }

    const apiMatchId = match.apiMatchId;
    this.setData({ subscribingMatchId: apiMatchId });
    this.applyStatus(this.data.activeStatus);

    try {
      const code = await login();
      await api.cancelMatchSubscription({
        code,
        apiMatchId
      });
      this.setData({
        subscribedMatchIds: this.data.subscribedMatchIds.filter((id) => id !== apiMatchId),
        subscribingMatchId: null
      });
      this.applyStatus(this.data.activeStatus);
      wx.showToast({ title: '已取消订阅', icon: 'success' });
    } catch (error) {
      this.setData({ subscribingMatchId: null });
      this.applyStatus(this.data.activeStatus);
      wx.showToast({
        title: error.message || '取消失败',
        icon: 'none'
      });
    }
  },

  onMatchTap(event) {
    const apiMatchId = Number(event.currentTarget.dataset.matchId);
    const canViewDetail = event.currentTarget.dataset.canViewDetail;
    if (!apiMatchId || (canViewDetail !== true && canViewDetail !== 'true')) {
      return;
    }
    wx.navigateTo({
      url: `/pages/match-detail/match-detail?apiMatchId=${apiMatchId}`
    });
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
  },

  matchName(match) {
    return `${match.homeName || teamName(match.homeTeam)} vs ${match.awayName || teamName(match.awayTeam)}`;
  }
});

function confirmCancelSubscription(matchName) {
  return new Promise((resolve) => {
    wx.showModal({
      title: '取消订阅',
      content: `确定取消 ${matchName} 的开赛提醒吗？`,
      confirmText: '取消订阅',
      confirmColor: '#b23b2e',
      success(result) {
        resolve(Boolean(result.confirm));
      },
      fail() {
        resolve(false);
      }
    });
  });
}
