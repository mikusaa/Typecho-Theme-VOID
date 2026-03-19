.PHONY: build dev
default: build

node_modules: package.json
	npm install

clean: node_modules
	npx gulp clean

dev: node_modules
	npx gulp dev

build: node_modules
	npx gulp build
