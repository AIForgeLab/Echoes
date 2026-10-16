import { DEMO_MODE } from '../config'
import type { DataAdapter } from './adapter'
import { demoAdapter } from './demoAdapter'
import { supabaseAdapter } from './supabaseAdapter'

/** The active data source. Chosen once at startup from configuration, never switched silently. */
export const data: DataAdapter = DEMO_MODE ? demoAdapter : supabaseAdapter
