# Architecture Documentation

This document describes the architecture, design decisions, and data flow of the Identus integration suite.

## System Overview

The integration suite is a TypeScript-based system that orchestrates end-to-end testing between Identus components. It manages test execution, result aggregation, report generation, and notification delivery.

## High-Level Architecture

```
┌─────────────────┐
│  GitHub Actions │
│   (Triggers)    │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Environment    │
│  Generation     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Cloud Setup    │
│  (Services)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐      ┌──────────────┐
│   SDK Runners   │──────│  Test        │──────│  Allure      │
│  (Parallel)     │      │  Execution   │      │  Results     │
└────────┬────────┘      └──────────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐
│  Report         │
│  Generation     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌───────────────┐
│  GitHub Pages   │      │  Slack        │
│  Deployment     │      │  Notification │
└─────────────────┘      └───────────────┘
```
