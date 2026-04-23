/**
 * GraphQL Cache Control Plugin
 */
import { Plugin } from '@nestjs/apollo';
import { Injectable } from '@nestjs/common';

@Injectable()
@Plugin()
export class CacheControlPlugin {}
