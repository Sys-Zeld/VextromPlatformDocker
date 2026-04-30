-- Cria os 4 bancos de dados da plataforma.
-- Este script é executado apenas na primeira inicialização do container.
SELECT 'CREATE DATABASE dbspeflow'   WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'dbspeflow')\gexec
SELECT 'CREATE DATABASE dbmodulespec' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'dbmodulespec')\gexec
SELECT 'CREATE DATABASE reportservice' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'reportservice')\gexec
SELECT 'CREATE DATABASE configdb'    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'configdb')\gexec
