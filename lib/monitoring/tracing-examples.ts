/**
 * Tracing Usage Examples
 * 
 * This file demonstrates how to use the OpenTelemetry tracing system
 * that has been added to the Talk-To-My-Lawyer application.
 * 
 * DO NOT RUN THIS FILE - it's for documentation/examples only
 */

import { createClient } from '@/lib/supabase/server'
import { 
  createAISpan, 
  createBusinessSpan, 
  createDatabaseSpan,
  traceAsync,
  addSpanAttributes,
  recordSpanEvent
} from '@/lib/monitoring/tracing'
import { traceDbQuery, traceDbRpc } from '@/lib/monitoring/db-tracing'
import { generateTextWithRetry } from '@/lib/ai/openai-retry'

// ============================================================================
// EXAMPLE 1: Manual Span Creation for AI Operations
// ============================================================================

export async function exampleAIOperation() {
  const span = createAISpan('custom_ai_generation', {
    'ai.model': 'gpt-4-turbo',
    'ai.operation_type': 'content_generation'
  })

  try {
    recordSpanEvent('ai_operation_started')
    
    // Your AI operation here
    const result = await generateTextWithRetry({
      prompt: "Generate a greeting",
      temperature: 0.7
    })

    addSpanAttributes({
      'ai.response_length': result.text.length,
      'ai.attempts': result.attempts
    })

    recordSpanEvent('ai_operation_completed', {
      response_length: result.text.length
    })

    span.setStatus({ code: 1 }) // SUCCESS
    return result
    
  } catch (error) {
    span.recordException(error as Error)
    span.setStatus({ 
      code: 2, // ERROR
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  } finally {
    span.end()
  }
}

// ============================================================================
// EXAMPLE 2: Async Function Tracing (Simpler Approach)
// ============================================================================

export async function exampleBusinessOperation(userId: string) {
  return await traceAsync(
    'business.process_user_request',
    async () => {
      // Your business logic here
      recordSpanEvent('processing_started', { user_id: userId })
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100))
      
      recordSpanEvent('processing_completed')
      return { success: true, userId }
    },
    { 
      'user.id': userId,
      'business.operation': 'process_request'
    }
  )
}

// ============================================================================
// EXAMPLE 3: Database Operation Tracing
// ============================================================================

export async function exampleDatabaseOperations(userId: string) {
  const supabase = await createClient()

  // Method 1: Using traceDbQuery helper
  const userProfile = await traceDbQuery(
    'select',
    'profiles',
    async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) throw error
      return data
    },
    { 'user.id': userId }
  )

  // Method 2: Using traceDbRpc helper for stored procedures
  const allowance = await traceDbRpc(
    'check_letter_allowance',
    async () => {
      const { data, error } = await supabase
        .rpc('check_letter_allowance', { u_id: userId })
      
      if (error) throw error
      return data
    },
    { 'user.id': userId }
  )

  return { userProfile, allowance }
}

// ============================================================================
// EXAMPLE 4: API Route with Complete Tracing
// ============================================================================

export async function exampleAPIRoute(request: Request) {
  const span = createBusinessSpan('api.example_endpoint', {
    'http.method': 'POST',
    'http.route': '/api/example'
  })

  try {
    recordSpanEvent('request_received')
    
    // 1. Extract request data
    const body = await request.json()
    addSpanAttributes({
      'request.has_data': !!body,
      'request.fields_count': Object.keys(body).length
    })

    // 2. Database operation
    const supabase = await createClient()
    const result = await traceDbQuery(
      'insert',
      'example_table',
      async () => {
        const { data, error } = await supabase
          .from('example_table')
          .insert(body)
          .select()
        
        if (error) throw error
        return data
      }
    )

    // 3. AI processing (if needed)
    if (body.needsAIProcessing) {
      await traceAsync(
        'ai.process_content',
        async () => {
          return await generateTextWithRetry({
            prompt: body.content,
            temperature: 0.5
          })
        }
      )
    }

    addSpanAttributes({
      'response.success': true,
      'response.items_created': result.length
    })

    recordSpanEvent('request_completed')
    span.setStatus({ code: 1 }) // SUCCESS

    return Response.json({ success: true, data: result })

  } catch (error) {
    span.recordException(error as Error)
    span.setStatus({ 
      code: 2, // ERROR
      message: error instanceof Error ? error.message : 'API request failed'
    })

    recordSpanEvent('request_failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    span.end()
  }
}

// ============================================================================
// EXAMPLE 5: Complex Multi-Step Operation
// ============================================================================

export async function exampleComplexOperation(letterData: any) {
  return await traceAsync(
    'business.generate_and_process_letter',
    async () => {
      // Step 1: Validate input
      recordSpanEvent('validation_started')
      if (!letterData.type || !letterData.content) {
        throw new Error('Invalid letter data')
      }
      recordSpanEvent('validation_passed')

      // Step 2: Generate AI content
      const aiContent = await traceAsync(
        'ai.generate_letter_content',
        async () => {
          return await generateTextWithRetry({
            prompt: `Generate a ${letterData.type} letter: ${letterData.content}`,
            temperature: 0.7
          })
        },
        { 'letter.type': letterData.type }
      )

      // Step 3: Save to database
      const supabase = await createClient()
      const savedLetter = await traceDbQuery(
        'insert',
        'letters',
        async () => {
          const { data, error } = await supabase
            .from('letters')
            .insert({
              title: letterData.title,
              letter_type: letterData.type,
              ai_draft_content: aiContent.text,
              status: 'pending_review'
            })
            .select()
            .single()
          
          if (error) throw error
          return data
        }
      )

      // Step 4: Send notification
      recordSpanEvent('notification_sent', {
        letter_id: savedLetter.id
      })

      addSpanAttributes({
        'letter.id': savedLetter.id,
        'letter.type': letterData.type,
        'ai.content_length': aiContent.text.length,
        'ai.attempts': aiContent.attempts
      })

      return savedLetter
    }
  )
}

// ============================================================================
// HOW TO VIEW TRACES
// ============================================================================

/*
To view traces in development:

1. Start Jaeger:
   docker run -d --name jaeger \
     -p 16686:16686 \
     -p 4317:4317 \
     -p 4318:4318 \
     jaegertracing/all-in-one:latest

2. Set environment variable (optional):
   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces

3. Start your app:
   pnpm dev

4. Make some API calls to generate traces

5. View traces in Jaeger UI:
   http://localhost:16686

6. Search for service "talk-to-my-lawyer" to see all traces
*/

// ============================================================================
// PRODUCTION CONFIGURATION
// ============================================================================

/*
For production, set these environment variables:

# Your observability platform endpoint
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-platform.com/v1/traces

# Authentication headers (if required)
OTEL_EXPORTER_OTLP_HEADERS='{"authorization":"Bearer YOUR_TOKEN"}'

# Service identification
OTEL_SERVICE_NAME=talk-to-my-lawyer
OTEL_SERVICE_VERSION=1.0.0

# Optional: Disable tracing
OTEL_SDK_DISABLED=false
*/
