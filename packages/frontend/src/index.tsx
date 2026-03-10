#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import { App } from './App'

const relayUrl = process.argv[2] || 'http://localhost:3000'

render(<App relayUrl={relayUrl} />)
