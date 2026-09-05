.PHONY: default clean dev dev-build watch build verify

GULP := ./node_modules/.bin/gulp

default: build

node_modules/.package-lock.json: package.json package-lock.json
	npm ci

clean: node_modules/.package-lock.json
	$(GULP) clean

dev: dev-build

dev-build: node_modules/.package-lock.json
	$(GULP) dev-build
	npm run dev-build:check

watch: node_modules/.package-lock.json
	$(GULP) watch

build: node_modules/.package-lock.json
	$(GULP) build
	npm run fonts:check
	npm run build:check

verify: node_modules/.package-lock.json
	npm run lint
	npm test
	npm run lint:php
	npm run test:php
	$(MAKE) build
	git diff --check
