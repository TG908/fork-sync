"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const Github = __importStar(require("@actions/github"));
const rest_1 = require("@octokit/rest");
const token = core.getInput('token', { required: true });
const context = Github.context;
async function run() {
    let owner = core.getInput('owner', { required: false }) || context.repo.owner;
    let repo = core.getInput('repo', { required: false }) || context.repo.repo;
    const base = core.getInput('base', { required: false });
    const head = core.getInput('head', { required: false });
    const mergeMethod = core.getInput('merge_method', { required: false });
    const prTitle = core.getInput('pr_title', { required: false });
    const prMessage = core.getInput('pr_message', { required: false });
    const ignoreFail = core.getBooleanInput('ignore_fail', { required: false });
    const autoApprove = core.getBooleanInput('auto_approve', { required: false });
    const autoMerge = core.getBooleanInput('auto_merge', { required: false });
    const retries = parseInt(core.getInput('retries', { required: false })) ?? 4;
    const retryAfter = parseInt(core.getInput('retry_after', { required: false })) ?? 60;
    const octokit = new rest_1.Octokit({ auth: token });
    let r = await octokit.rest.repos.get({
        owner,
        repo,
    });
    if (r && r.data && r.data.parent) {
        owner = r.data.parent.owner.login || owner;
        repo = r.data.parent.name || repo;
    }
    try {
        let pr = await octokit.rest.pulls.create({ owner: context.repo.owner, repo: context.repo.repo, title: prTitle, head: owner + ':' + head, base: base, body: prMessage, maintainer_can_modify: false });
        await delay(20);
        if (autoApprove) {
            await octokit.rest.pulls.createReview({ owner: context.repo.owner, repo: context.repo.repo, pull_number: pr.data.number, event: "COMMENT", body: "Auto approved" });
            await octokit.rest.pulls.createReview({ owner: context.repo.owner, repo: context.repo.repo, pull_number: pr.data.number, event: "APPROVE" });
        }
        if (autoMerge) {
            if (mergeMethod == "merge") {
                await octokit.rest.pulls.merge({ owner: context.repo.owner, repo: context.repo.repo, pull_number: pr.data.number, merge_method: "merge" });
            }
            else if (mergeMethod == "rebase") {
                await octokit.rest.pulls.merge({ owner: context.repo.owner, repo: context.repo.repo, pull_number: pr.data.number, merge_method: "rebase" });
            }
            else if (mergeMethod == "squash") {
                await octokit.rest.pulls.merge({ owner: context.repo.owner, repo: context.repo.repo, pull_number: pr.data.number, merge_method: "squash" });
            }
            else {
                core.setFailed(`Unknown merge_method: ${mergeMethod}`);
                return;
            }
        }
    }
    catch (error) {
        if (error?.request?.request?.retryCount) {
            console.log(`request failed after ${error.request.request.retryCount} retries with a delay of ${error.request.request.retryAfter}`);
        }
        if ((error?.errors ?? error?.response?.data?.errors)?.[0]?.message?.startsWith('No commits between')) {
            console.log('No commits between ' + context.repo.owner + ':' + base + ' and ' + owner + ':' + head);
        }
        else if ((error?.errors ?? error?.response?.data?.errors)?.[0]?.message?.startsWith('A pull request already exists for')) {
            // we were already done
            console.log((error?.errors ?? error?.response?.data?.errors)?.[0]?.message);
        }
        else {
            if (!ignoreFail) {
                core.setFailed(`Failed to create or merge pull request: ${error ?? "[n/a]"}`);
            }
        }
    }
}
function delay(s) {
    return new Promise(resolve => setTimeout(resolve, s * 1000));
}
run();
//# sourceMappingURL=main.js.map