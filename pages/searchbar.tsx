 <div className="flex items-center gap-2 rounded-2xl border border-slate-900 bg-slate-950/80 px-4 py-3 text-[11px]">
              <span className="text-slate-500">🔍</span>
              <input
                className="flex-1 bg-transparent text-[11px] text-slate-100 outline-none"
                placeholder="Search drops by title or creator"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>