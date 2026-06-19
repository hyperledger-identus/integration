#!/bin/bash

set -e
set -u

function create_user_and_database() {
	local database=$1
	local app_user="${database}-application-user"
	local app_password="${POSTGRES_APP_PASSWORD:-${POSTGRES_PASSWORD}}"
	echo "  Creating user and database '$database'"
	# Quoted heredoc ('EOSQL') prevents shell expansion inside the SQL;
	# values are passed as psql variables via -v and referenced with psql's
	# :"var" (quoted identifier) / :'var' (quoted string literal) syntax.
	psql \
		-v ON_ERROR_STOP=1 \
		--username "$POSTGRES_USER" \
		-v db_name="$database" \
		-v app_user="$app_user" \
		-v app_pwd="$app_password" \
		<<-'EOSQL'
		CREATE USER :"app_user" WITH PASSWORD :'app_pwd';
		CREATE DATABASE :"db_name";
		\c :"db_name"
		ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
	EOSQL
}

if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
	echo "Multiple database creation requested: $POSTGRES_MULTIPLE_DATABASES"
	for db in $(echo "$POSTGRES_MULTIPLE_DATABASES" | tr ',' ' '); do
		create_user_and_database "$db"
	done
	echo "Multiple databases created"
fi