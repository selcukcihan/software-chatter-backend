import { Service, Inject } from 'typedi'
import axiosRetry from 'axios-retry'
import axios from 'axios'
import qs from 'qs'
import { TwitterApi } from 'twitter-api-v2'

axiosRetry(axios, { retries: 3 })

type Meta = {
  result_count: number
  next_token: string
}

type User = {
  id: string
  name: string
  username: string
}

type PublicMetrics = {
  like_count: number
}

type Data = {
  author_id: string
  lang: string
  text: string
  created_at: Date
  public_metrics: PublicMetrics
  id: string
  context_annotations?: {
    domain: {
      id: string,
      name: string,
    },
    entity: {
      id: string,
      name: string,
    },
  } []
}

export type TwitterResponse = {
  meta: Meta
  includes: {
    users: User[]
  }
  data: Data[]
}

@Service()
export class Twitter {
  constructor(
    @Inject('TWITTER_API') private readonly twitterApi: TwitterApi,
    @Inject('TWITTER_BEARER_TOKEN') private readonly twitterBearerToken: string,
  ) {}

  async timeline(since: Date, paginationToken?: string): Promise<TwitterResponse> {
    const response = await this.twitterApi.v2.homeTimeline({
      exclude: ['replies', 'retweets'],
      max_results: 100,
      'tweet.fields': 'created_at,public_metrics,author_id,context_annotations,entities,lang',
      'user.fields': 'username',
      expansions: 'author_id',
      pagination_token: paginationToken,
      start_time: since.toISOString(),
    })

    return {
      meta: response.meta as Meta,
      includes: {
        users: response.includes.users as User[],
      },
      data: response.tweets.map(t => ({
        ...t,
        created_at: new Date(t.created_at as string),
      })) as Data[],
    }
  }

  async search(since: Date, paginationToken?: string) {
    const CONTEXTS = [
      'context:131.898673391980261376',
      'context:66.898673391980261376', 
      'context:131.898645455344517120',
      'context:65.898645455344517120', 
      'context:131.898648511855550464',
      'context:65.898648511855550464', 
      'context:131.848921413196984320',
      'context:66.848921413196984320', 
      'context:66.898659750950207489', 
      'context:131.898661583827615744',
      'context:66.898661583827615744', 
      'context:131.898262889378619392',
      'context:165.898262889378619392',
    ]
    const QUERY = `(${CONTEXTS.join(' OR ')}) (lang:en) -is:retweet -is:reply`
    const config = {
      url: 'https://api.twitter.com/2/tweets/search/recent?' + qs.stringify({
        query: QUERY,
        max_results: 100,
        'tweet.fields': 'created_at,public_metrics,author_id,context_annotations,entities,lang',
        'user.fields': 'username',
        expansions: 'author_id',
        next_token: paginationToken,
        start_time: since.toISOString(),
      }),
      method: 'get',
      headers: {
        Authorization: `Bearer ${this.twitterBearerToken}`,
      },
    }

    const _response = await axios.request(config)
    return _response.data as TwitterResponse
  }
}
