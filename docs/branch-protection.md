# Branch Protection and Rulesets

## Purpose
This document defines the standardized branch protection rules and GitHub rulesets for the Hyperledger Identus ecosystem. Consistent rules ensure SDLC stability, security, and a unified development experience across all repositories.

## Scope
The rules defined here serve as the baseline for the default branch (`main` or `master`) across the following repositories:
- cloud-agent
- mediator
- sdk-ts
- sdk-swift
- sdk-kmp
- apollo
- prism-node

## Expected Outcomes
Implementation of these rules yields the following measurable improvements:
- **Reduces accidental direct pushes**: Prevents unreviewed code from entering stable branches.
- **Improves CI reliability**: Ensures all code passes automated tests before merging.
- **Enforces review discipline**: Guarantees a "four-eyes" principle for every change.

## Standardized Rules

### Pull Request Requirements
- **Require a pull request before merging**: No direct pushes allowed.
- **Required Approvals**: **Strict minimum of 2 approvals** from designated maintainers or code owners.
- **Dismiss stale approvals**: Reviews are automatically dismissed when new commits are pushed.
- **Require conversation resolution**: All review comments must be resolved before merging.

### Status Checks
The following logic applies to status checks:
- **Strict Requirement**: Branches **must** be up to date with the default branch before merging.
- **Context Naming**: Use repository-specific CI check names (e.g., `CI / build`, `Lint`, `Test`). 
- **Minimum Checks**: Every repository MUST require at least:
  - CI Build/Compilation
  - Linting/Static Analysis
  - Unit Tests
  - Integration/E2E Tests (where available)

> [!CAUTION]
> **Fallback Safety**: Ensure that all required status checks are actually configured and running in the repository’s CI workflows *before* enabling enforcement. If a check is listed but doesn't exist, all PR merges will be blocked.

### Branch Maintenance
- **Restrict Force Pushes**: (Enforced) No history rewriting on protected branches.
- **Restrict Deletion**: (Enforced) No deletion of the default branch.

## Application & Rollout Strategy

### Phased Rollout
Maintainers should avoid a "big bang" rollout across all repositories simultaneously. Recommended path:
1. **Phase 1 (Pilot)**: Apply to a low-risk or actively maintained repository (e.g., `sdk-ts`) in **Evaluate** mode to monitor impact without blocking workflows.
2. **Phase 2 (Validation)**: Switch to **Active** mode on the pilot repository and validate CI compatibility.
3. **Phase 3 (Expansion)**: Gradually apply to other SDKs and core components (`cloud-agent`, `mediator`).

### Enforcement Modes
- **Evaluate**: Rules are checked, and results are reported in the PR, but merging is not blocked. Use this for testing new rules.
- **Active**: Rules are strictly enforced.

## Exception Handling & Emergency Scenarios
In extreme cases (e.g., critical security hotfixes or broken CI blocking urgent releases), the following protocols apply:

- **Admin Bypass**: Organization owners and repository admins can be added to the "Bypass list" in the Ruleset configuration.
  - **Restriction**: Use **sparingly** and only for verified emergencies.
  - **Audit**: Every bypass merge should be followed by a **post-merge review** to ensure technical correctness.
- **Temporary Relaxation**: If a systemic CI issue occurs, a Ruleset can be temporarily set to **Evaluate** mode or internally adjusted by authorized maintainers.

## Application Guide (How to Apply)
This repository includes a baseline configuration template in [main-branch-protection.json](../.github/rulesets/main-branch-protection.json).

### To apply to a new repository:
1. Go to **Settings** > **Rules** > **Rulesets**.
2. Click **New ruleset** > **Import ruleset**.
3. Upload the `main-branch-protection.json` file.
4. **Important**: Update the `required_status_checks` list in the UI to match the exact names of the CI workflows in that specific repository.
5. Set enforcement to **Evaluate** (initially) or **Active**.
