import * as core from '@actions/core'
import * as Github from '@actions/github'
import { Octokit } from '@octokit/rest'

const token = core.getInput('token', { required: true })
const context = Github.context

async function run() {
  let owner = core.getInput('owner', { required: false }) || context.repo.owner
  let repo = core.getInput('repo', { required: false }) || context.repo.repo
  const base = core.getInput('base', { required: false })
  const head = core.getInput('head', { required: false })
  const headRepo = core.getInput('head_repo', { required: false })
  const mergeMethod = core.getInput('merge_method', { required: false })
  const prTitle = core.getInput('pr_title', { required: false })
  const prMessage = core.getInput('pr_message', { required: false })
  const ignoreFail = core.getBooleanInput('ignore_fail', { required: false })
  const autoApprove = core.getBooleanInput('auto_approve', { required: false })
  const autoMerge = core.getBooleanInput('auto_merge', { required: false })

  const octokit = new Octokit({ auth: token })

  const r = await octokit.rest.repos.get({
    owner,
    repo,
  })

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (r && r.data && r.data.parent) {
    owner = r.data.parent.owner.login || owner
    repo = r.data.parent.name || repo
  }

  try {
    const pr = await octokit.rest.pulls.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: prTitle,
      head: owner + ':' + head,
      head_repo: headRepo,
      base,
      body: prMessage,
      maintainer_can_modify: false,
    })
    await delay(20)
    if (autoApprove) {
      await octokit.rest.pulls.createReview({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: pr.data.number,
        event: 'COMMENT',
        body: 'Auto approved',
      })
      await octokit.rest.pulls.createReview({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: pr.data.number,
        event: 'APPROVE',
      })
    }

    if (autoMerge) {
      switch (mergeMethod) {
        case 'merge': {
          await octokit.rest.pulls.merge({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: pr.data.number,
            merge_method: 'merge',
          })

          break
        }

        case 'rebase': {
          await octokit.rest.pulls.merge({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: pr.data.number,
            merge_method: 'rebase',
          })

          break
        }

        case 'squash': {
          await octokit.rest.pulls.merge({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: pr.data.number,
            merge_method: 'squash',
          })

          break
        }

        default: {
          core.setFailed(`Unknown merge_method: ${mergeMethod}`)
        }
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error?.request?.request?.retryCount) {
      console.log(
        `request failed after ${error.request.request.retryCount} retries with a delay of ${error.request.request.retryAfter}`
      )
    }

    if (
      (error?.errors ?? error?.response?.data?.errors)?.[0]?.message?.startsWith(
        'No commits between'
      )
    ) {
      console.log(
        'No commits between ' + context.repo.owner + ':' + base + ' and ' + owner + ':' + head
      )
    } else if (
      (error?.errors ?? error?.response?.data?.errors)?.[0]?.message?.startsWith(
        'A pull request already exists for'
      )
    ) {
      // we were already done
      console.log(error.errors[0].message)
    } else {
      if (!ignoreFail) {
        core.setFailed(`Failed to create or merge pull request: ${error ?? '[n/a]'}`)
      }
    }
  }
}

function delay(s: number) {
  return new Promise((resolve) => setTimeout(resolve, s * 1000))
}

run()
