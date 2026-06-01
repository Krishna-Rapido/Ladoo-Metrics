import { useCallback, useEffect, useState } from "react"
import {
  listSchemaTables,
  listRelationships,
  type SchemaTable,
  type SchemaRelationship,
} from "@/lib/knowledgeApi"

export function useKnowledgeData() {
  const [tables, setTables] = useState<SchemaTable[]>([])
  const [relationships, setRelationships] = useState<SchemaRelationship[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [t, r] = await Promise.all([listSchemaTables(), listRelationships()])
      setTables(t)
      setRelationships(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load knowledge graph")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { tables, relationships, loading, error, refresh }
}
