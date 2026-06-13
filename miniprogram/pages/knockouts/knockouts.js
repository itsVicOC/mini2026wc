const api = require('../../services/api');
const { scoreText, teamName } = require('../../utils/format');

Page({
  data: {
    loading: true,
    error: '',
    stages: [],
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

  async loadData() {
    this.setData({ loading: true, error: '' });
    try {
      const stages = await api.getKnockouts();
      this.setData({
        stages: stages.map((stage) => ({
          ...stage,
          title: this.stageTitle(stage.stage),
          matches: (stage.matches || []).map((match) => ({
            ...match,
            scoreText: scoreText(match),
            homeName: teamName(match.homeTeam),
            awayName: teamName(match.awayTeam),
            showPenalty: match.score && match.score.penaltyHome !== null && match.score.penaltyHome !== undefined
          }))
        })),
        showEmpty: stages.length === 0,
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '淘汰赛加载失败'
      });
    }
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
    return map[stage] || stage || '待定阶段';
  }
});
