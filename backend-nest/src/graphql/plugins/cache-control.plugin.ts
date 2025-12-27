/**
 * GraphQL Cache Control Plugin
 */
import { Injectable } from '@nestjs/common';
import { Plugin } from '@nestjs/apollo';

@Injectable()
@Plugin()
export class CacheControlPlugin {}
