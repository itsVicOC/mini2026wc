import { env } from '../config/env.js';
import { badGateway, serviceUnavailable } from '../utils/errors.js';

type Code2SessionResponse = {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

type AccessTokenResponse = {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};

type SubscribeMessageResponse = {
  errcode?: number;
  errmsg?: string;
  msgid?: string;
};

let cachedAccessToken: {
  token: string;
  expiresAt: number;
} | null = null;

export function assertWechatConfigured() {
  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET || !env.WECHAT_SUBSCRIBE_TEMPLATE_ID) {
    throw serviceUnavailable('微信订阅消息未配置，请检查 WECHAT_APP_ID、WECHAT_APP_SECRET、WECHAT_SUBSCRIBE_TEMPLATE_ID');
  }
}

export async function codeToOpenid(code: string) {
  assertWechatConfigured();

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', env.WECHAT_APP_ID);
  url.searchParams.set('secret', env.WECHAT_APP_SECRET);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  const data = await requestWechat<Code2SessionResponse>(url);
  if (!data.openid) {
    throw badGateway(`微信登录失败：${data.errmsg || data.errcode || 'missing openid'}`);
  }
  return data.openid;
}

export async function sendSubscribeMessage(params: {
  openid: string;
  apiMatchId: number;
  matchName: string;
  beijingTimeText: string;
}) {
  assertWechatConfigured();
  const accessToken = await getAccessToken();
  const url = new URL('https://api.weixin.qq.com/cgi-bin/message/subscribe/send');
  url.searchParams.set('access_token', accessToken);

  const page = `${env.WECHAT_SUBSCRIBE_PAGE}?matchId=${params.apiMatchId}`;
  const data = {
    [env.WECHAT_SUBSCRIBE_MATCH_KEY]: {
      value: limitTemplateValue(params.matchName, 20)
    },
    [env.WECHAT_SUBSCRIBE_TIME_KEY]: {
      value: params.beijingTimeText
    },
    [env.WECHAT_SUBSCRIBE_TIP_KEY]: {
      value: '比赛即将开始'
    }
  };

  const response = await requestWechat<SubscribeMessageResponse>(url, {
    method: 'POST',
    body: JSON.stringify({
      touser: params.openid,
      template_id: env.WECHAT_SUBSCRIBE_TEMPLATE_ID,
      page,
      data,
      miniprogram_state: env.NODE_ENV === 'production' ? 'formal' : 'developer',
      lang: 'zh_CN'
    })
  });

  if (response.errcode && response.errcode !== 0) {
    throw badGateway(`微信订阅消息发送失败：${response.errmsg || response.errcode}`);
  }

  return response.msgid ?? null;
}

async function getAccessToken() {
  assertWechatConfigured();
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60_000) {
    return cachedAccessToken.token;
  }

  const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
  url.searchParams.set('grant_type', 'client_credential');
  url.searchParams.set('appid', env.WECHAT_APP_ID);
  url.searchParams.set('secret', env.WECHAT_APP_SECRET);

  const data = await requestWechat<AccessTokenResponse>(url);
  if (!data.access_token) {
    throw badGateway(`微信 access_token 获取失败：${data.errmsg || data.errcode || 'missing access_token'}`);
  }

  cachedAccessToken = {
    token: data.access_token,
    expiresAt: now + Math.max(60, data.expires_in ?? 7200) * 1000
  };
  return cachedAccessToken.token;
}

async function requestWechat<T>(url: URL, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    throw badGateway(`微信接口请求异常：${formatError(error)}`);
  }
  const text = await response.text();
  if (!response.ok) {
    throw badGateway(`微信接口请求失败：${response.status} ${text}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw badGateway(`微信接口响应异常：${text.slice(0, 200)}`);
  }
}

function limitTemplateValue(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
