/**
 * ============================================================================
 * REAL-TIME PULSE - GRAPHQL TYPES
 * ============================================================================
 * GraphQL object types and input types for the schema.
 */

import { ObjectType, Field, ID, InputType, Int } from '@nestjs/graphql';

// Portal Types
@ObjectType()
export class PortalType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  slug: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => [WidgetType])
  widgets: WidgetType[];
}

@ObjectType()
export class WidgetType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  type: string;
}

// Input Types
@InputType()
export class CreatePortalInput {
  @Field()
  name: string;

  @Field()
  slug: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  isPublic?: boolean;

  @Field(() => [String], { nullable: true })
  layout?: string[];
}

@InputType()
export class UpdatePortalInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  slug?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  isPublic?: boolean;

  @Field(() => [String], { nullable: true })
  layout?: string[];
}

@ObjectType()
export class PortalConnection {
  @Field(() => [PortalType])
  nodes: PortalType[];

  @Field(() => Int)
  totalCount: number;
}

@InputType()
export class PortalFilterInput {
  @Field({ nullable: true })
  search?: string;

  @Field({ nullable: true })
  isPublic?: boolean;

  @Field({ nullable: true })
  createdAfter?: string;

  @Field({ nullable: true })
  createdBefore?: string;
}

@InputType()
export class PortalSortInput {
  @Field({ nullable: true })
  field?: string;

  @Field({ nullable: true })
  direction?: string;
}
