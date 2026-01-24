import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FederatedSearchService, SearchOptions } from './federated-search.service';
import { SemanticSearchService } from './semantic-search.service';

@ApiTags('Federated Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class FederatedSearchController {
  constructor(
    private readonly searchService: FederatedSearchService,
    private readonly semanticService: SemanticSearchService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Search across all data sources' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({
    name: 'sources',
    required: false,
    description: 'Comma-separated source IDs',
  })
  @ApiQuery({
    name: 'types',
    required: false,
    description: 'Comma-separated result types',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results' })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Offset for pagination',
  })
  @ApiQuery({
    name: 'semantic',
    required: false,
    description: 'Enable semantic search',
  })
  @ApiQuery({
    name: 'correlate',
    required: false,
    description: 'Find correlations',
  })
  async search(
    @Request() req: any,
    @Query('q') query: string,
    @Query('sources') sources?: string,
    @Query('types') types?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('semantic') semantic?: string,
    @Query('correlate') correlate?: string,
  ) {
    const options: SearchOptions = {
      query,
      sources: sources?.split(','),
      types: types?.split(','),
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      semantic: semantic !== 'false',
      correlate: correlate === 'true',
    };

    return this.searchService.search(req.user.workspaceId, options);
  }

  @Post('natural')
  @ApiOperation({ summary: 'Natural language search' })
  async naturalLanguageSearch(@Request() req: any, @Body() dto: { query: string }) {
    // Parse natural language query
    const parsed = await this.semanticService.parseNaturalLanguageQuery(dto.query);

    // Perform search with extracted filters
    const results = await this.searchService.search(req.user.workspaceId, {
      query: dto.query,
      ...parsed.filters,
      semantic: true,
    });

    return {
      ...results,
      parsed,
    };
  }

  @Get('sources')
  @ApiOperation({ summary: 'Get available data sources' })
  async getDataSources(@Request() req: any) {
    return this.searchService.getDataSources(req.user.workspaceId);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get search suggestions' })
  @ApiQuery({ name: 'prefix', required: true, description: 'Search prefix' })
  async getSuggestions(@Request() req: any, @Query('prefix') prefix: string) {
    return this.searchService.getSuggestions(req.user.workspaceId, prefix);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent searches' })
  async getRecentSearches(@Request() req: any) {
    return this.searchService.getRecentSearches(req.user.workspaceId, req.user.id);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get search analytics' })
  async getSearchAnalytics(@Request() req: any) {
    return this.searchService.getSearchAnalytics(req.user.workspaceId);
  }
}
