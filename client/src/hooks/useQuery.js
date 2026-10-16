import { useEffect, useState } from "react";
import { get, errorMessage } from "../services/api";
export function useQuery(url, params = {}) {
  const [state, setState] = useState({
    loading: true,
    result: null,
    error: "",
  });
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify(params);
  useEffect(() => {
    let active = true;
    setState((old) => ({ ...old, loading: true, error: "" }));
    get(url, JSON.parse(key))
      .then((result) => {
        if (active) setState({ loading: false, result, error: "" });
      })
      .catch((e) => {
        if (active)
          setState({ loading: false, result: null, error: errorMessage(e) });
      });
    return () => {
      active = false;
    };
  }, [url, key, revision]);
  return { ...state, reload: () => setRevision((n) => n + 1) };
}
