# VibeStack Debug Tools & Commands

This directory contains debugging information and tools for common VibeStack issues.

## 📁 Debug Files

- **`legend-state-flooding-fix.md`** - Complete analysis and fix for Legend State infinite loop flooding issue (2025-08-23)

## 🛠️ Common Debug Commands

### Legend State Issues
```bash
# Check Legend State configuration
grep -r "fieldCreatedAt\|fieldUpdatedAt\|syncedCrud" apps/web/src/legend-state/

# Monitor Legend State observables in browser console
# Open DevTools and check: window.vibestackOrgContext

# Clear IndexedDB persistence cache
rm -rf ~/.config/google-chrome/Default/IndexedDB/http_localhost_5173.indexeddb*
```

### Server Flooding Detection  
```bash
# Monitor for POST/PUT flooding
tail -f <(pnpm dev 2>&1) | grep -E "(POST|PUT).*data/"

# Check WAL polling activity  
tail -f <(pnpm dev 2>&1) | grep "SIMPLIFIED WAL CHANGES DETECTED"

# Monitor WebSocket notifications
tail -f <(pnpm dev 2>&1) | grep "WebSocket notification"
```

### Database Debugging
```bash
# Check entity table sizes
psql postgres://localhost:5432/vibestack_dev -c "
SELECT 
  schemaname,
  tablename, 
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes
FROM pg_stat_user_tables 
WHERE tablename LIKE 'org_%_entity_%' 
ORDER BY n_tup_upd DESC;"

# Monitor WAL activity
psql postgres://localhost:5432/vibestack_dev -c "
SELECT slot_name, confirmed_flush_lsn, restart_lsn 
FROM pg_replication_slots;"

# Clear entity data for organization (DANGEROUS - use carefully)
# psql postgres://localhost:5432/vibestack_dev -c "
# DELETE FROM org_01920000_1000_7000_8000_000000000001_[entity_name];"
```

### Performance Analysis
```bash
# Check background processes
./scripts/check-background-processes.sh

# Monitor memory usage
ps aux | grep -E "(node|wrangler)" | sort -k4 -nr

# Check port usage
netstat -tulpn | grep -E "(5173|8787|5432|4444)"
```

### WebSocket Connection Issues
```bash
# Test WebSocket connectivity  
wscat -c ws://localhost:8787/api/sync?clientId=test&organizationId=01920000-1000-7000-8000-000000000001&lsn=0/0

# Check Durable Objects status in Wrangler logs
tail -f <(pnpm dev 2>&1) | grep -E "(SyncDO|ReplicationDO)"
```

## 🚨 Emergency Reset Commands

### Nuclear Option - Complete Reset
```bash
# 1. Stop all services
pnpm run stop-all  # or manually kill processes

# 2. Clear all caches
rm -rf node_modules/.cache
rm -rf apps/web/node_modules/.cache  
rm -rf apps/server/node_modules/.cache
rm -rf ~/.config/google-chrome/Default/IndexedDB/http_localhost_5173.indexeddb*

# 3. Reset database to clean state
./scripts/init-local-from-remote.sh

# 4. Restart clean
pnpm install
pnpm dev
```

### Targeted Legend State Reset
```bash
# Clear only Legend State related data
rm -rf ~/.config/google-chrome/Default/IndexedDB/http_localhost_5173.indexeddb*

# Restart dev server to reinitialize Legend State
# Kill existing pnpm dev and restart
```

## 📊 Health Check Commands

### Quick System Status
```bash
# All services running?
curl -s http://localhost:5173/health || echo "Web app down"
curl -s http://localhost:8787/health || echo "Server down"  
pg_isready -h localhost -p 5432 || echo "Database down"

# Legend State status (in browser console)
# window.vibestackOrgContext.get()
```

### Performance Baseline
```bash
# Normal startup should show:
# - 17 GET requests for entity data loading
# - WebSocket connection established
# - No continuous POST/PUT loops
# - WAL polling quiet (no repeated changes)

# Monitor for 30 seconds after startup:
timeout 30 tail -f <(pnpm dev 2>&1) | grep -E "(POST|PUT|WebSocket|WAL)"
```

## 🔍 Debugging Workflow

1. **Identify Symptoms**
   - Server flooding? → Check Legend State configuration
   - Slow loading? → Check network requests in DevTools  
   - WebSocket issues? → Check Durable Objects logs
   - Database errors? → Check PostgreSQL logs

2. **Gather Information**  
   - Browser DevTools Network tab
   - Server logs from `pnpm dev`
   - Database query logs
   - Legend State observable state

3. **Apply Targeted Fix**
   - Configuration issue → Update and restart
   - Data issue → Clear and reinitialize  
   - Cache issue → Clear caches
   - Last resort → Nuclear reset

4. **Verify Fix**
   - Monitor for normal startup pattern
   - Check performance baseline
   - Test core functionality

## 📚 Reference Links

- [Legend State Documentation](https://legendapp.com/open-source/state/)
- [Durable Objects Debugging](https://developers.cloudflare.com/durable-objects/)
- [PostgreSQL WAL Documentation](https://www.postgresql.org/docs/current/wal.html)
- [VibeStack Architecture Overview](../docs/architecture.md)