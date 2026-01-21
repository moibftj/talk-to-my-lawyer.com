#!/bin/bash

# Tracing Setup Validation Script
# This script helps you verify that OpenTelemetry tracing is working correctly

set -e

echo "🔍 Talk-To-My-Lawyer Tracing Setup Validation"
echo "=============================================="

# Check if required dependencies are installed
echo "📦 Checking OpenTelemetry dependencies..."
if ! pnpm list @opentelemetry/api > /dev/null 2>&1; then
    echo "❌ OpenTelemetry dependencies not found. Run 'pnpm install' first."
    exit 1
fi
echo "✅ OpenTelemetry dependencies found"

# Check if Jaeger is running (optional)
echo ""
echo "🏃 Checking if Jaeger trace collector is running..."
if curl -s http://localhost:16686 > /dev/null 2>&1; then
    echo "✅ Jaeger UI is accessible at http://localhost:16686"
elif curl -s http://localhost:4318/v1/traces > /dev/null 2>&1; then
    echo "✅ OTLP endpoint is accessible at http://localhost:4318"
else
    echo "⚠️  No trace collector detected. You can start Jaeger with:"
    echo "   docker run -d --name jaeger \\"
    echo "     -p 16686:16686 -p 4317:4317 -p 4318:4318 \\"
    echo "     jaegertracing/all-in-one:latest"
fi

# Check environment configuration
echo ""
echo "⚙️  Checking environment configuration..."
if [ -f .env.local ]; then
    if grep -q "OTEL_EXPORTER_OTLP_ENDPOINT" .env.local; then
        endpoint=$(grep "OTEL_EXPORTER_OTLP_ENDPOINT" .env.local | cut -d'=' -f2)
        echo "✅ OTLP endpoint configured: $endpoint"
    else
        echo "ℹ️  OTLP endpoint not configured (will use default: http://localhost:4318/v1/traces)"
    fi
    
    if grep -q "OTEL_SDK_DISABLED=true" .env.local; then
        echo "⚠️  Tracing is DISABLED (OTEL_SDK_DISABLED=true)"
    else
        echo "✅ Tracing is enabled"
    fi
else
    echo "ℹ️  No .env.local found (will use default configuration)"
fi

# Check if instrumentation file exists and is properly configured
echo ""
echo "🔧 Checking instrumentation setup..."
if [ -f instrumentation.ts ]; then
    if grep -q "initializeTracing" instrumentation.ts; then
        echo "✅ Tracing initialization found in instrumentation.ts"
    else
        echo "❌ Tracing initialization missing in instrumentation.ts"
        exit 1
    fi
else
    echo "❌ instrumentation.ts file not found"
    exit 1
fi

# Check if tracing modules exist
echo ""
echo "📄 Checking tracing modules..."
if [ -f lib/monitoring/tracing.ts ]; then
    echo "✅ Main tracing module found"
else
    echo "❌ Main tracing module missing: lib/monitoring/tracing.ts"
    exit 1
fi

if [ -f lib/monitoring/db-tracing.ts ]; then
    echo "✅ Database tracing helper found"
else
    echo "❌ Database tracing helper missing: lib/monitoring/db-tracing.ts"
    exit 1
fi

# Try to compile TypeScript
echo ""
echo "🏗️  Checking TypeScript compilation..."
if npx tsc --noEmit > /dev/null 2>&1; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed. Check for syntax errors."
    exit 1
fi

echo ""
echo "🎉 Tracing setup validation completed!"
echo ""
echo "📚 Next steps:"
echo "   1. Start a trace collector (Jaeger recommended for development)"
echo "   2. Start your app with 'pnpm dev'"
echo "   3. Make some API calls to generate traces"
echo "   4. View traces in your collector UI"
echo ""
echo "📖 See docs/TRACING.md for detailed usage instructions"
