const api = require('../../services/api');
const { canViewMatchDetail, openTeamDetail, scoreText, teamName } = require('../../utils/format');
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
    activeStage: '',
    stageFilters: buildStageFilters(''),
    allMatches: [],
    stages: [],
    subscribingMatchId: null,
    subscribedMatchIds: [],
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
      title: '2026 世界杯淘汰赛',
      path: '/pages/knockouts/knockouts'
    };
  },

  onShareTimeline() {
    return {
      title: '2026 世界杯淘汰赛'
    };
  },

  onStageTap(event) {
    this.applyStage(event.currentTarget.dataset.value || '');
  },

  async loadData() {
    this.setData({ loading: true, error: '' });
    try {
      const stages = await api.getKnockouts();
      const allMatches = stages.reduce((result, stage) => {
        return result.concat((stage.matches || []).map((match) => ({
          ...match,
          stage: match.stage || stage.stage
        })));
      }, []);
      this.setData({
        allMatches: allMatches.map((match) => this.decorateMatch(match)),
        showEmpty: allMatches.length === 0,
        loading: false
      });
      this.applyStage(this.data.activeStage);
      this.loadSubscriptionStatus();
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '淘汰赛加载失败'
      });
    }
  },

  applyStage(activeStage) {
    const matches = this.data.allMatches.filter((match) => !activeStage || stageKey(match.stage) === activeStage);
    const grouped = groupByStage(matches).map((stage) => ({
      ...stage,
      title: this.stageTitle(stage.stage)
    }));

    this.setData({
      activeStage,
      stageFilters: buildStageFilters(activeStage),
      stages: grouped,
      showEmpty: matches.length === 0
    });
  },

  decorateMatch(match) {
    const decorated = decorateSubscriptionState(match, this.data.subscribedMatchIds, this.data.subscribingMatchId);
    const hasConfirmedTeams = Boolean(match.homeTeam && match.homeTeam.apiTeamId && match.awayTeam && match.awayTeam.apiTeamId);
    return {
      ...decorated,
      scoreText: scoreText(match),
      homeName: teamName(match.homeTeam),
      awayName: teamName(match.awayTeam),
      canViewDetail: canViewMatchDetail(match),
      showSubscribeButton: hasConfirmedTeams && (decorated.canSubscribe || decorated.subscribed),
      showPenalty: match.score && match.score.penaltyHome !== null && match.score.penaltyHome !== undefined
    };
  },

  async onSubscribeTap(event) {
    const apiMatchId = Number(event.currentTarget.dataset.matchId);
    if (!apiMatchId || this.data.subscribingMatchId) {
      return;
    }
    const match = this.data.allMatches.find((item) => item.apiMatchId === apiMatchId);
    if (!match) {
      return;
    }
    if (!match.showSubscribeButton) {
      return;
    }
    if (this.data.subscribedMatchIds.indexOf(apiMatchId) >= 0) {
      this.cancelSubscription(match);
      return;
    }
    if (!canSubscribeMatch(match)) {
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
      this.setData({
        subscribedMatchIds: Array.from(new Set([...this.data.subscribedMatchIds, apiMatchId])),
        subscribingMatchId: null
      });
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

  async cancelSubscription(match) {
    const confirmed = await confirmCancelSubscription(this.matchName(match));
    if (!confirmed) {
      return;
    }
    const apiMatchId = match.apiMatchId;
    this.setData({ subscribingMatchId: apiMatchId });
    this.refreshSubscriptionState();

    try {
      const code = await login();
      await api.cancelMatchSubscription({ code, apiMatchId });
      this.setData({
        subscribedMatchIds: this.data.subscribedMatchIds.filter((id) => id !== apiMatchId),
        subscribingMatchId: null
      });
      this.refreshSubscriptionState();
      wx.showToast({ title: '已取消订阅', icon: 'success' });
    } catch (error) {
      this.setData({ subscribingMatchId: null });
      this.refreshSubscriptionState();
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

  onTeamTap(event) {
    openTeamDetail(event.currentTarget.dataset.teamId);
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
      this.refreshSubscriptionState();
    } catch (error) {
      console.warn('[subscription status failed]', error);
    }
  },

  refreshSubscriptionState() {
    this.setData({
      allMatches: this.data.allMatches.map((match) => this.decorateMatch(match))
    });
    this.applyStage(this.data.activeStage);
  },

  matchName(match) {
    return `${match.homeName || teamName(match.homeTeam)} vs ${match.awayName || teamName(match.awayTeam)}`;
  },

  stageTitle(stage) {
    const map = {
      LAST_32: '32 强',
      LAST_16: '16 强',
      QUARTER_FINALS: '8 强',
      SEMI_FINALS: '半决赛',
      THIRD_PLACE: '三四名决赛',
      FINAL: '决赛'
    };
    return map[stageKey(stage)] || stage || '待定阶段';
  }
});

function buildStageFilters(activeStage) {
  return [
    { label: '全部', value: '' },
    { label: '32 强', value: 'LAST_32' },
    { label: '16 强', value: 'LAST_16' },
    { label: '8 强', value: 'QUARTER_FINALS' },
    { label: '半决赛', value: 'SEMI_FINALS' },
    { label: '三四名决赛', value: 'THIRD_PLACE' },
    { label: '决赛', value: 'FINAL' }
  ].map((item) => ({
    ...item,
    className: item.value === activeStage ? 'filter active' : 'filter'
  }));
}

function groupByStage(matches) {
  const groups = new Map();
  for (const match of matches) {
    const stage = stageKey(match.stage);
    groups.set(stage, [...(groups.get(stage) || []), match]);
  }
  return Array.from(groups.entries()).map(([stage, stageMatches]) => ({
    stage,
    matches: stageMatches
  }));
}

function stageKey(stage) {
  const normalized = String(stage || 'UNKNOWN').trim().toUpperCase();
  const aliases = {
    ROUND_OF_32: 'LAST_32',
    ROUND_OF_16: 'LAST_16',
    QUARTER_FINAL: 'QUARTER_FINALS',
    QUARTERFINALS: 'QUARTER_FINALS',
    SEMI_FINAL: 'SEMI_FINALS',
    SEMIFINALS: 'SEMI_FINALS',
    THIRD_PLACE_PLAYOFF: 'THIRD_PLACE'
  };
  return aliases[normalized] || normalized;
}

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
