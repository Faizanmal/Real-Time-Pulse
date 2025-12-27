/**
 * =============================================================================
 * REAL-TIME PULSE - OPTIMISTIC UPDATES HOOK
 * =============================================================================
 * 
 * Provides optimistic update capabilities with automatic rollback on failure.
 */

import { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient, MutationFunction } from '@tanstack/react-query';
import { toast } from 'sonner';

interface OptimisticUpdateOptions<TData, TVariables, TContext> {
  // Query key(s) to invalidate on success
  queryKey: string | readonly unknown[];
  
  // Function to optimistically update the cache before mutation
  optimisticUpdate?: (variables: TVariables, previousData: TData | undefined) => TData;
  
  // Success callback
  onSuccess?: (data: TData, variables: TVariables, context: TContext) => void;
  
  // Error callback (after rollback)
  onError?: (error: Error, variables: TVariables, context: TContext) => void;
  
  // Success message to show
  successMessage?: string;
  
  // Error message to show
  errorMessage?: string;
  
  // Whether to show toast notifications
  showToast?: boolean;
  
  // Rollback delay (for UI smoothness)
  rollbackDelay?: number;
}

interface OptimisticMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  isSuccess: boolean;
  data: TData | undefined;
  reset: () => void;
  // Optimistic state tracking
  isOptimistic: boolean;
  pendingMutations: number;
}

/**
 * Hook for optimistic mutations with automatic rollback
 */
export function useOptimisticMutation<
  TData = unknown,
  TVariables = void,
  TContext = unknown,
>(
  mutationFn: MutationFunction<TData, TVariables>,
  options: OptimisticUpdateOptions<TData, TVariables, TContext>,
): OptimisticMutationResult<TData, TVariables> {
  const queryClient = useQueryClient();
  const [isOptimistic, setIsOptimistic] = useState(false);
  const pendingMutationsRef = useRef(0);
  const [pendingMutations, setPendingMutations] = useState(0);

  const {
    queryKey,
    optimisticUpdate,
    onSuccess,
    onError,
    successMessage,
    errorMessage = 'An error occurred. Changes have been reverted.',
    showToast = true,
    rollbackDelay = 300,
  } = options;

  const mutation = useMutation<TData, Error, TVariables, { previousData: TData | undefined }>({
    mutationFn,
    
    // Before mutation: optimistically update cache
    onMutate: async (variables) => {
      pendingMutationsRef.current++;
      setPendingMutations(pendingMutationsRef.current);
      setIsOptimistic(true);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: [queryKey] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<TData>([queryKey]);

      // Optimistically update cache
      if (optimisticUpdate && previousData !== undefined) {
        const newData = optimisticUpdate(variables, previousData);
        queryClient.setQueryData([queryKey], newData);
      }

      return { previousData };
    },

    // On error: rollback to previous value
    onError: (error, variables, context) => {
      pendingMutationsRef.current--;
      setPendingMutations(pendingMutationsRef.current);

      // Rollback with slight delay for smoother UX
      setTimeout(() => {
        if (context?.previousData !== undefined) {
          queryClient.setQueryData([queryKey], context.previousData);
        }
        
        if (pendingMutationsRef.current === 0) {
          setIsOptimistic(false);
        }
      }, rollbackDelay);

      if (showToast) {
        toast.error(errorMessage, {
          description: error.message,
        });
      }

      onError?.(error, variables, context as TContext);
    },

    // On success: invalidate and refetch
    onSuccess: (data, variables, context) => {
      pendingMutationsRef.current--;
      setPendingMutations(pendingMutationsRef.current);
      
      if (pendingMutationsRef.current === 0) {
        setIsOptimistic(false);
      }

      if (showToast && successMessage) {
        toast.success(successMessage);
      }

      onSuccess?.(data, variables, context as TContext);
    },

    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });

  return {
    ...mutation,
    isOptimistic,
    pendingMutations,
  };
}

/**
 * Hook for optimistic list operations (add, update, delete)
 */
export function useOptimisticList<TItem extends { id: string }>(
  queryKey: string | readonly unknown[],
  options: {
    showToast?: boolean;
  } = {},
) {
  const queryClient = useQueryClient();
  const { showToast = true } = options;

  // Optimistically add item to list
  const addItem = useCallback(
    async <TVariables>(
      mutationFn: MutationFunction<TItem, TVariables>,
      variables: TVariables,
      tempItem: TItem,
    ): Promise<TItem> => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: [queryKey] });

      // Snapshot previous value
      const previousItems = queryClient.getQueryData<TItem[]>([queryKey]);

      // Optimistically add to list
      queryClient.setQueryData<TItem[]>([queryKey], (old) => [
        ...(old || []),
        tempItem,
      ]);

      try {
        const result = await mutationFn(variables);
        
        // Replace temp item with real item
        queryClient.setQueryData<TItem[]>([queryKey], (old) =>
          old?.map((item) => (item.id === tempItem.id ? result : item)),
        );

        if (showToast) {
          toast.success('Item added successfully');
        }

        return result;
      } catch (error) {
        // Rollback
        queryClient.setQueryData([queryKey], previousItems);
        
        if (showToast) {
          toast.error('Failed to add item');
        }
        
        throw error;
      }
    },
    [queryClient, queryKey, showToast],
  );

  // Optimistically update item in list
  const updateItem = useCallback(
    async <TVariables>(
      mutationFn: MutationFunction<TItem, TVariables>,
      variables: TVariables,
      itemId: string,
      updates: Partial<TItem>,
    ): Promise<TItem> => {
      await queryClient.cancelQueries({ queryKey: [queryKey] });

      const previousItems = queryClient.getQueryData<TItem[]>([queryKey]);

      // Optimistically update
      queryClient.setQueryData<TItem[]>([queryKey], (old) =>
        old?.map((item) =>
          item.id === itemId ? { ...item, ...updates } : item,
        ),
      );

      try {
        const result = await mutationFn(variables);
        
        queryClient.setQueryData<TItem[]>([queryKey], (old) =>
          old?.map((item) => (item.id === itemId ? result : item)),
        );

        if (showToast) {
          toast.success('Item updated successfully');
        }

        return result;
      } catch (error) {
        queryClient.setQueryData([queryKey], previousItems);
        
        if (showToast) {
          toast.error('Failed to update item');
        }
        
        throw error;
      }
    },
    [queryClient, queryKey, showToast],
  );

  // Optimistically delete item from list
  const deleteItem = useCallback(
    async <TVariables>(
      mutationFn: MutationFunction<void, TVariables>,
      variables: TVariables,
      itemId: string,
    ): Promise<void> => {
      await queryClient.cancelQueries({ queryKey: [queryKey] });

      const previousItems = queryClient.getQueryData<TItem[]>([queryKey]);

      // Optimistically remove
      queryClient.setQueryData<TItem[]>([queryKey], (old) =>
        old?.filter((item) => item.id !== itemId),
      );

      try {
        await mutationFn(variables);

        if (showToast) {
          toast.success('Item deleted successfully');
        }
      } catch (error) {
        queryClient.setQueryData([queryKey], previousItems);
        
        if (showToast) {
          toast.error('Failed to delete item');
        }
        
        throw error;
      }
    },
    [queryClient, queryKey, showToast],
  );

  // Optimistically reorder items
  const reorderItems = useCallback(
    async <TVariables>(
      mutationFn: MutationFunction<void, TVariables>,
      variables: TVariables,
      newOrder: TItem[],
    ): Promise<void> => {
      await queryClient.cancelQueries({ queryKey: [queryKey] });

      const previousItems = queryClient.getQueryData<TItem[]>([queryKey]);

      // Optimistically reorder
      queryClient.setQueryData([queryKey], newOrder);

      try {
        await mutationFn(variables);

        if (showToast) {
          toast.success('Order updated');
        }
      } catch (error) {
        queryClient.setQueryData([queryKey], previousItems);
        
        if (showToast) {
          toast.error('Failed to update order');
        }
        
        throw error;
      }
    },
    [queryClient, queryKey, showToast],
  );

  return {
    addItem,
    updateItem,
    deleteItem,
    reorderItems,
  };
}

/**
 * Hook for batch optimistic operations
 */
export function useOptimisticBatch<TItem extends { id: string }>(
  queryKey: string | readonly unknown[],
) {
  const queryClient = useQueryClient();
  const operationsRef = useRef<Array<{
    type: 'add' | 'update' | 'delete';
    item: TItem | string;
    previousState: TItem[];
  }>>([]);

  const startBatch = useCallback(() => {
    operationsRef.current = [];
  }, []);

  const addOperation = useCallback(
    (type: 'add' | 'update' | 'delete', item: TItem | string) => {
      const previousState = queryClient.getQueryData<TItem[]>([queryKey]) || [];
      
      operationsRef.current.push({
        type,
        item,
        previousState,
      });

      // Apply optimistically
      queryClient.setQueryData<TItem[]>([queryKey], (old) => {
        const current = old || [];
        
        switch (type) {
          case 'add':
            return [...current, item as TItem];
          case 'update':
            return current.map((i) =>
              i.id === (item as TItem).id ? (item as TItem) : i,
            );
          case 'delete':
            return current.filter((i) => i.id !== (item as string));
          default:
            return current;
        }
      });
    },
    [queryClient, queryKey],
  );

  const commitBatch = useCallback(
    async (mutationFn: () => Promise<void>) => {
      try {
        await mutationFn();
        operationsRef.current = [];
        toast.success('Changes saved');
      } catch (error) {
        // Rollback all operations in reverse order
        const firstState = operationsRef.current[0]?.previousState;
        if (firstState) {
          queryClient.setQueryData([queryKey], firstState);
        }
        operationsRef.current = [];
        toast.error('Failed to save changes');
        throw error;
      }
    },
    [queryClient, queryKey],
  );

  const rollbackBatch = useCallback(() => {
    const firstState = operationsRef.current[0]?.previousState;
    if (firstState) {
      queryClient.setQueryData([queryKey], firstState);
    }
    operationsRef.current = [];
  }, [queryClient, queryKey]);

  return {
    startBatch,
    addOperation,
    commitBatch,
    rollbackBatch,
    pendingOperations: operationsRef.current.length,
  };
}
