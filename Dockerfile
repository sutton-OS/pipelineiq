FROM node:20-alpine

WORKDIR /app

# Install dependencies first to maximize layer reuse.
COPY package.json package-lock.json ./
COPY apps/worker/package.json apps/worker/package-lock.json ./apps/worker/
COPY packages/engine ./packages/engine
RUN npm ci && npm --prefix apps/worker ci

# Copy source after dependency install.
COPY . .

# Build-time placeholders keep env validation and Next build deterministic.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG DATABASE_URL=postgresql://postgres:postgres@db:5432/pipelineiq
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_docker
ARG CLERK_SECRET_KEY=sk_test_docker
ARG NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=anon_docker
ARG SUPABASE_SERVICE_ROLE_KEY=service_role_docker
ARG STRIPE_SECRET_KEY=sk_test_docker
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_docker
ARG STRIPE_PRO_PRICE_ID=price_docker
ARG STRIPE_WEBHOOK_SECRET=whsec_docker

ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    DATABASE_URL=${DATABASE_URL} \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY} \
    CLERK_SECRET_KEY=${CLERK_SECRET_KEY} \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY} \
    STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY} \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY} \
    STRIPE_PRO_PRICE_ID=${STRIPE_PRO_PRICE_ID} \
    STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}

RUN npm run build && npm run worker:build

ENV NODE_ENV=production \
    PORT=3000 \
    WORKER_HEALTH_PORT=8081

EXPOSE 3000 8081

CMD ["npm", "run", "start"]
