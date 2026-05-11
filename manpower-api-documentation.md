# Manpower Allocation API

## Architecture

The backend supports multiple shift allocations per precinct natively via a composite unique key on `(PrecinctId, Shift)`. No client-side workaround is needed.

### Database Schema
- **Table**: `Manpower`
- **Unique Index**: `IX_Manpower_PrecinctId_Shift` on `(PrecinctId, Shift)`
- **Shift Enum**: `Morning = 0`, `Evening = 1`, `Night = 2`

### Backend Layers
| Layer | Key File | Role |
|-------|----------|------|
| Domain | `Domain/Entities/Manpower.cs` | Entity with PrecinctId, Shift, HeadCount |
| Domain | `Domain/Enums/ShiftEnum.cs` | Morning=0, Evening=1, Night=2 |
| Infrastructure | `Data/Configurations/ManpowerConfiguration.cs` | Composite unique index on (PrecinctId, Shift) |
| Infrastructure | `Data/Repositories/ManpowerRepository.cs` | `UpsertAsync(precinctId, shift, headCount)` — creates or updates based on PrecinctId+Shift combo |
| Application | `UseCase/Manpower/Commands/CreateManpower/` | `UpsertManpowerCommand` + handler delegating to `UpsertAsync` |
| WebAPI | `Controllers/ManpowerController.cs` | `POST /api/manpower/upsert` endpoint |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/manpower` | List all allocations |
| GET | `/api/manpower/{id}` | Get by ID |
| GET | `/api/manpower/precinct/{precinctId}` | Get by precinct (all shifts) |
| POST | `/api/manpower/upsert` | Create or update (keyed by PrecinctId + Shift) |
| PUT | `/api/manpower/{id}` | Update headcount |
| GET | `/api/manpower/precincts` | List active precincts |
| GET | `/api/manpower/shifts` | List shift definitions |
| GET | `/api/manpower/summary` | Aggregated summary |

### Upsert (Preferred)
```
POST /api/manpower/upsert
{
  "precinctId": "guid",
  "shift": 0,
  "headCount": 10
}
```
- If a record with the same `precinctId + shift` exists: updates headcount
- If not: creates a new record
- No 409 Conflict possible since the composite key is `(PrecinctId, Shift)`

## Frontend Integration

**File**: `src/utils/manpowerApi.ts`

### Shift Mapping
- `0` → Morning (6AM-2PM)
- `1` → Evening/Afternoon (2PM-10PM)  
- `2` → Night (10PM-6AM)

### Key Methods
| Method | API Call | Description |
|--------|----------|-------------|
| `getAllManpower()` | `GET /api/manpower` | Returns all allocations with shift info |
| `getAllManpowerWithShifts()` | `GET /api/manpower` | Same but converts numeric shifts to display strings |
| `upsertManpower({precinctId, shift, headCount})` | `POST /api/manpower/upsert` | Creates or updates by precinct+shift |
| `createOrUpdateManpowerWithShift({precinctId, headCount, shift})` | `POST /api/manpower/upsert` | Accepts string shift name, converts to number internally |

### Using Shifts
```typescript
// Create or update a shift allocation
await manpowerApi.createOrUpdateManpowerWithShift({
  precinctId: "guid",
  headCount: 8,
  shift: "Night"
});

// Read allocations with shift display
const allocations = await manpowerApi.getAllManpowerWithShifts();
```

### Frontend Consumers
- `/app/precincts/page.tsx` — CRUD for manpower allocations per shift
- `/app/forecast/ManpowerAllocation.tsx` — Shift analysis and recommendations

## Testing
```powershell
# Create Morning shift allocation
Invoke-WebRequest -Uri "http://localhost:5041/api/manpower/upsert" -Method POST `
  -Body '{"precinctId":"guid","shift":0,"headCount":10}' `
  -ContentType "application/json"

# Get all
Invoke-WebRequest -Uri "http://localhost:5041/api/manpower" -Method GET
```
