import { env } from '../config/env.js';

type RequestOptions = {
  searchParams?: Record<string, string | number | undefined>;
};

export class FootballDataClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor() {
    this.baseUrl = env.FOOTBALL_DATA_API_BASE_URL.replace(/\/$/, '');
    this.token = env.FOOTBALL_DATA_API_TOKEN;
  }

  async getMatches() {
    return this.request<FootballDataMatchesResponse>(
      `/competitions/${env.FOOTBALL_DATA_COMPETITION}/matches`,
      {
        searchParams: {
          season: env.FOOTBALL_DATA_SEASON
        }
      }
    );
  }

  async getStandings() {
    return this.request<FootballDataStandingsResponse>(
      `/competitions/${env.FOOTBALL_DATA_COMPETITION}/standings`,
      {
        searchParams: {
          season: env.FOOTBALL_DATA_SEASON
        }
      }
    );
  }

  async getScorers() {
    return this.request<FootballDataScorersResponse>(
      `/competitions/${env.FOOTBALL_DATA_COMPETITION}/scorers`,
      {
        searchParams: {
          season: env.FOOTBALL_DATA_SEASON,
          limit: 100
        }
      }
    );
  }

  async getTeams() {
    return this.request<FootballDataTeamsResponse>(
      `/competitions/${env.FOOTBALL_DATA_COMPETITION}/teams`,
      {
        searchParams: {
          season: env.FOOTBALL_DATA_SEASON
        }
      }
    );
  }

  private async request<T>(path: string, options: RequestOptions = {}) {
    if (!this.token) {
      throw new Error('FOOTBALL_DATA_API_TOKEN is not configured');
    }

    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(options.searchParams ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      headers: {
        'X-Auth-Token': this.token
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`football-data.org ${response.status}: ${body}`);
    }

    return (await response.json()) as T;
  }
}

export type FootballDataTeam = {
  id?: number;
  name?: string;
  shortName?: string;
  tla?: string;
  crest?: string;
};

export type FootballDataMatch = {
  id: number;
  utcDate: string;
  status: string;
  matchday?: number;
  stage?: string;
  group?: string;
  lastUpdated?: string;
  homeTeam?: FootballDataTeam;
  awayTeam?: FootballDataTeam;
  score?: {
    winner?: string;
    fullTime?: {
      home?: number | null;
      away?: number | null;
    };
    halfTime?: {
      home?: number | null;
      away?: number | null;
    };
    extraTime?: {
      home?: number | null;
      away?: number | null;
    };
    penalties?: {
      home?: number | null;
      away?: number | null;
    };
  };
  venue?: string;
};

export type FootballDataMatchesResponse = {
  competition?: {
    code?: string;
    name?: string;
  };
  matches?: FootballDataMatch[];
};

export type FootballDataStandingTableRow = {
  position: number;
  team: FootballDataTeam;
  group?: string;
  playedGames?: number;
  won?: number;
  draw?: number;
  lost?: number;
  points?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;
  form?: string | null;
};

export type FootballDataStanding = {
  stage?: string;
  type?: string;
  group?: string;
  table?: FootballDataStandingTableRow[];
};

export type FootballDataStandingsResponse = {
  standings?: FootballDataStanding[];
};

export type FootballDataScorer = {
  player?: {
    id?: number;
    name?: string;
  };
  team?: FootballDataTeam;
  goals?: number;
  assists?: number | null;
  penalties?: number | null;
  playedMatches?: number | null;
};

export type FootballDataScorersResponse = {
  scorers?: FootballDataScorer[];
};

export type FootballDataTeamsResponse = {
  teams?: FootballDataTeam[];
};
