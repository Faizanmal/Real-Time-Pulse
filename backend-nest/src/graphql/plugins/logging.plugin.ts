/**
 * GraphQL Logging Plugin
 */
import { Injectable } from '@nestjs/common';
import { Plugin } from '@nestjs/apollo';

@Injectable()
@Plugin()
export class LoggingPlugin {}
