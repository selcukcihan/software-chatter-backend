import { Service, Inject } from 'typedi'
import axiosRetry from 'axios-retry'
import axios from 'axios'
import qs from 'qs'

axiosRetry(axios, { retries: 3 })

@Service()
export class Processor {
  constructor(
  ) {}

  async search(since: Date, paginationToken?: string) {
    const response = await axios({
      url: 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
      method: 'post',
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      },
      data: { inputs: '' },
    })
    if (
      typeof response.data === 'object' &&
      response.data.length > 0 &&
      response.data[0].summary_text
    ) {
      return response.data[0].summary_text
    } else {
      return ''
    }
  }
}
