import { Inject, Service } from 'typedi'
import { Twitter, TwitterResponse } from './twitter'
import { Tweet } from './models'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { sleep } from './utils'

const MAX_TWEET_COUNT = 10000

const getUser = (page: TwitterResponse, d: { author_id: string }) => page.includes.users.find(u => u.id === d.author_id)?.username

@Service()
export class Crawler {
  constructor(
    private readonly twitter: Twitter,
    @Inject('S3_CLIENT') private readonly s3Client: S3Client,
    @Inject('S3_BUCKET') private readonly s3Bucket: string,
  ) {}

  async run() {
    const now = Date.now()
    const since = new Date(now - (24 * 3600 * 1000))
    const timeline: Tweet[] = [] // await this._run('timeline', since)
    const search = await this._run('search', since)
    const all = timeline
      .concat(search)
      .reduce((acc, cur) => (acc.set(cur.link, cur)) && acc, new Map<string, Tweet>())
    const tweets = [...all.values()].sort((x, y) => y.likes - x.likes)
    await this.s3Client.send(new PutObjectCommand({
      Body: JSON.stringify(tweets),
      Key: `latest/all.json`,
      Bucket: this.s3Bucket,
    }))
    console.log(`Sourced ${tweets.length} tweets.`)
  }

  async _run(mode: 'timeline' | 'search', since: Date) {
    let paginationToken: string | undefined = undefined
    const tweets: Tweet[] = []
    let iteration = 0
    while (tweets.length < MAX_TWEET_COUNT) {
      iteration++

      const page: TwitterResponse = mode === 'search'
        ? await this.twitter.search(since, paginationToken)
        : await this.twitter.timeline(since, paginationToken)

      console.log(`${mode}: Processing iteration ${iteration}: ${page.meta.result_count}`)
      paginationToken = page.meta.next_token
      if (page.data.length > 0) {
        tweets.push(...page.data.map(d => ({
          text: d.text,
          lang: d.lang,
          likes: d.public_metrics.like_count,
          link: `https://twitter.com/${getUser(page, d)}/status/${d.id}`,
          author: `@${getUser(page, d)}`,
          context: (d.context_annotations || []).map(c => c.entity.name.toLowerCase()),
        })))
      }

      if (!paginationToken) {
        break
      }
      await sleep(500)
    }
    console.log(`${mode}: Fetched ${tweets.length} tweets for ${since}`)
    if (tweets.length > 0) {
      await this.s3Client.send(new PutObjectCommand({
        Body: JSON.stringify(tweets),
        Key: `latest/${mode}.json`,
        Bucket: this.s3Bucket,
      }))
    }
    return tweets
  }
}
