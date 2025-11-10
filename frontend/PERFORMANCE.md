# Frontend Performance Optimizations

## Animation Performance

All animations in Real-Time Pulse are optimized for 60fps performance and smooth user experience. Here's how we ensure optimal performance:

### 1. GPU-Accelerated Properties

We only animate properties that are GPU-accelerated:
- ✅ **transform** (translate, scale, rotate)
- ✅ **opacity**
- ❌ **width/height** (causes layout reflow)
- ❌ **top/left** (causes layout reflow)

### 2. willChange CSS Property

All animated components use `willChange: 'transform'` to inform the browser in advance:

```tsx
<motion.div style={{ willChange: 'transform' }}>
  {/* content */}
</motion.div>
```

### 3. Reduced Animation Complexity

- **Card animations**: Simple scale + translateY (max 2 properties)
- **Button hovers**: Scale only (1 property)
- **Fade animations**: Opacity only (1 property)
- **Background elements**: Marked as `pointer-events-none` to prevent interaction overhead

### 4. Optimized Transition Timings

All transitions use optimal durations:
- **Fast interactions**: 0.1s (buttons, icons)
- **Standard animations**: 0.2s (cards, modals)
- **Slower animations**: 0.3s (page transitions)
- **Background effects**: 20-25s (subtle, low-priority)

### 5. Stagger Delays

List animations use minimal stagger delays (0.03-0.05s) to prevent cumulative delay issues:

```tsx
transition={{ delay: index * 0.03 }}  // 30ms per item
```

### 6. Easing Functions

Using optimized easing curves for natural motion:
- **easeOut**: `[0.19, 1, 0.22, 1]` - Most animations
- **linear**: For continuous rotations only

### 7. Motion Configuration

```tsx
import { fadeInUp, cardHover, buttonHover } from '@/lib/motion';

// Use pre-configured variants
<motion.div variants={fadeInUp} />
```

## Component Optimizations

### 1. Memoization

React components use proper memoization where needed:
- `useCallback` for event handlers passed to children
- `useMemo` for expensive calculations
- `React.memo` for pure components

### 2. Virtual Scrolling

For large lists (>50 items), consider implementing virtual scrolling with `react-window` or `react-virtual`.

### 3. Image Optimization

- Use Next.js Image component for automatic optimization
- Implement lazy loading for images below the fold
- Use appropriate image formats (WebP with fallback)

### 4. Code Splitting

Pages are automatically code-split by Next.js:
```tsx
// Lazy load heavy components
const HeavyChart = dynamic(() => import('@/components/heavy-chart'), {
  loading: () => <Skeleton />,
  ssr: false
});
```

## WebSocket Optimizations

### 1. Connection Management

```tsx
// Single WebSocket connection per user
const { notifications, isConnected } = useNotifications();

// Cleanup on unmount
useEffect(() => {
  return () => socket.disconnect();
}, []);
```

### 2. Event Throttling

Real-time updates are batched to prevent excessive re-renders:
```tsx
// Debounce widget refresh events
const debouncedRefresh = debounce(handleRefresh, 300);
```

## Rendering Optimizations

### 1. Conditional Rendering

```tsx
// Prevent unnecessary renders
{isLoading ? <Skeleton /> : <Content />}

// Use React Suspense for async components
<Suspense fallback={<Loading />}>
  <AsyncComponent />
</Suspense>
```

### 2. Key Properties

Always use stable, unique keys for lists:
```tsx
// ✅ Good - stable ID
{items.map(item => <Card key={item.id} />)}

// ❌ Bad - unstable index
{items.map((item, index) => <Card key={index} />)}
```

### 3. Avoid Inline Functions

```tsx
// ❌ Bad - creates new function every render
<Button onClick={() => handleClick(id)} />

// ✅ Good - stable reference
const onClick = useCallback(() => handleClick(id), [id]);
<Button onClick={onClick} />
```

## State Management Optimizations

### 1. Zustand Performance

```tsx
// Only subscribe to needed state
const user = useAuthStore(state => state.user); // ✅
const { user, token } = useAuthStore(); // ❌ More re-renders
```

### 2. Local State vs Global State

- **Local state**: UI-only state (modals, forms)
- **Global state**: Shared data (user, workspace)
- **Server state**: Use React Query for caching

## Bundle Size Optimizations

### 1. Tree Shaking

Import only what you need:
```tsx
// ✅ Good
import { motion } from 'framer-motion';

// ❌ Bad
import * as FramerMotion from 'framer-motion';
```

### 2. Dynamic Imports

```tsx
// Load heavy libraries on demand
const PdfViewer = dynamic(() => import('react-pdf'), {
  ssr: false
});
```

## Browser DevTools

### Performance Profiling

1. Open Chrome DevTools
2. Go to Performance tab
3. Record while interacting
4. Look for:
   - Long tasks (>50ms)
   - Layout thrashing
   - Forced reflows

### React DevTools Profiler

1. Install React DevTools
2. Go to Profiler tab
3. Record a session
4. Identify unnecessary renders

## Performance Metrics

### Target Metrics

- **First Contentful Paint (FCP)**: < 1.8s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Time to Interactive (TTI)**: < 3.8s
- **First Input Delay (FID)**: < 100ms
- **Cumulative Layout Shift (CLS)**: < 0.1

### Monitoring

Use Lighthouse in Chrome DevTools:
```bash
# Run audit
npm run build
npm run start
# Then run Lighthouse in Chrome DevTools
```

## Best Practices Checklist

- ✅ All animations use GPU-accelerated properties only
- ✅ willChange applied to animated elements
- ✅ Animation durations kept under 300ms
- ✅ List stagger delays minimal (30-50ms)
- ✅ Background animations marked as pointer-events-none
- ✅ Component memoization where appropriate
- ✅ WebSocket connection properly cleaned up
- ✅ Images lazy loaded and optimized
- ✅ Code split heavy components
- ✅ Stable keys for all lists
- ✅ Event handlers memoized
- ✅ Tree shaking enabled
- ✅ Bundle size monitored

## Common Performance Issues & Solutions

### Issue: Janky scroll performance

**Solution**: Remove `position: fixed` animations, use `transform` instead

### Issue: Layout shifts during load

**Solution**: Set explicit dimensions on images and containers

### Issue: Slow initial page load

**Solution**: Code split heavy components, lazy load images

### Issue: Memory leaks with WebSocket

**Solution**: Proper cleanup in useEffect return function

### Issue: Too many re-renders

**Solution**: Use React DevTools Profiler, add memoization

## Additional Resources

- [Web.dev Performance](https://web.dev/performance/)
- [Framer Motion Performance](https://www.framer.com/motion/performance/)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [Next.js Performance](https://nextjs.org/docs/pages/building-your-application/optimizing)
