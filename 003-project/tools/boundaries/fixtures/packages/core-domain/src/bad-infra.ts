import { DATABASE_PACKAGE } from '@bolha/database';
import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';

export const bad = [DATABASE_PACKAGE, Injectable, readFileSync];
