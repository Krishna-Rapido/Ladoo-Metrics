"""
Function Executor Module
Provides sandboxed execution of user-defined Python functions that query Presto
and return captain_id x yyyymmdd level metrics.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import traceback
import re
from pyhive import presto


# Allowed imports for user functions
ALLOWED_IMPORTS = {
    'pandas': pd,
    'pd': pd,
    'numpy': np,
    'np': np,
    'datetime': datetime,
}

# Forbidden patterns in user code (security)
FORBIDDEN_PATTERNS = [
    r'import\s+os',
    r'import\s+sys',
    r'import\s+subprocess',
    r'import\s+shutil',
    r'__import__',
    r'eval\s*\(',
    r'exec\s*\(',
    r'compile\s*\(',
    r'open\s*\(',
    r'file\s*\(',
    r'input\s*\(',
    r'raw_input',
    r'globals\s*\(',
    r'locals\s*\(',
    r'vars\s*\(',
    r'dir\s*\(',
    r'getattr\s*\(',
    r'setattr\s*\(',
    r'delattr\s*\(',
    r'__builtins__',
    r'__class__',
    r'__bases__',
    r'__subclasses__',
]


def get_presto_connection(username: str):
    """Create a Presto connection with the given username"""
    presto_host = 'bi-trino-4.serving.data.production.internal'
    presto_port = '80'
    presto_connection = presto.connect(presto_host, presto_port, username=username)
    return presto_connection


def validate_code_security(code: str) -> Tuple[bool, Optional[str]]:
    """
    Check user code for forbidden patterns.
    Returns (is_safe, error_message)
    """
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, code, re.IGNORECASE):
            return False, f"Forbidden pattern detected: {pattern}"
    return True, None


def validate_output_format(df: pd.DataFrame) -> Tuple[bool, Optional[str]]:
    """
    Validate that the output DataFrame has the required columns.
    Must have 'captain_id' and 'yyyymmdd' columns.
    Returns (is_valid, error_message)
    """
    if not isinstance(df, pd.DataFrame):
        return False, "Function must return a pandas DataFrame"
    
    if df.empty:
        return False, "Function returned an empty DataFrame. Please check your query and parameters."
    
    required_cols = ['captain_id', 'yyyymmdd']
    missing = [col for col in required_cols if col not in df.columns]
    
    if missing:
        available_cols = list(df.columns)
        return False, f"Missing required columns: {missing}. Output must have 'captain_id' and 'yyyymmdd' columns.\nAvailable columns: {available_cols}"
    
    # Check for duplicate captain_id + yyyymmdd combinations
    duplicates = df.duplicated(subset=['captain_id', 'yyyymmdd'], keep=False)
    if duplicates.any():
        dup_count = df.duplicated(subset=['captain_id', 'yyyymmdd']).sum()
        total_rows = len(df)
        unique_combos = df[['captain_id', 'yyyymmdd']].drop_duplicates().shape[0]
        
        # Show sample duplicates
        sample_dups = df[duplicates][['captain_id', 'yyyymmdd']].head(5).values.tolist()
        
        error_msg = f"""Output has {dup_count} duplicate captain_id + yyyymmdd combinations.
Total rows: {total_rows}, Unique combinations: {unique_combos}
Sample duplicates (captain_id, yyyymmdd): {sample_dups}

Each captain_id + yyyymmdd combination must be unique.
Fix: Add aggregation (GROUP BY captain_id, yyyymmdd) or use ROW_NUMBER() to keep only one row per combination."""
        return False, error_msg
    
    return True, None


def execute_function(
    code: str,
    parameters: Dict[str, Any],
    username: str,
    timeout_seconds: int = 300
) -> Tuple[Optional[pd.DataFrame], Optional[str], Optional[List[str]]]:
    """
    Execute user-defined function code with given parameters.
    
    Args:
        code: Python function code (must define a function called 'compute_metrics')
        parameters: Dictionary of parameter values to pass to the function
        username: Presto username for database access
        timeout_seconds: Maximum execution time
    
    Returns:
        (result_df, error_message, output_columns)
    """
    # Security check
    is_safe, security_error = validate_code_security(code)
    if not is_safe:
        return None, f"Security Error: {security_error}", None
    
    # Create sandboxed execution environment
    presto_conn = None
    try:
        presto_conn = get_presto_connection(username)
        
        # Helper function for running SQL
        def run_query(sql: str) -> pd.DataFrame:
            """Execute a Presto SQL query and return results as DataFrame"""
            return pd.read_sql(sql, presto_conn)
        
        # Build execution namespace
        exec_namespace = {
            'pd': pd,
            'pandas': pd,
            'np': np,
            'numpy': np,
            'datetime': datetime,
            'run_query': run_query,
            'parameters': parameters,
        }
        
        # Execute the user code to define the function
        exec(code, exec_namespace)
        
        # Check that compute_metrics function was defined
        if 'compute_metrics' not in exec_namespace:
            return None, "Code must define a function called 'compute_metrics'", None
        
        compute_metrics = exec_namespace['compute_metrics']
        
        # Execute the function
        result = compute_metrics(parameters)
        
        # Validate output
        is_valid, validation_error = validate_output_format(result)
        if not is_valid:
            return None, f"Validation Error: {validation_error}", None
        
        # Get output columns (excluding captain_id and yyyymmdd)
        output_columns = [col for col in result.columns if col not in ['captain_id', 'yyyymmdd']]
        
        return result, None, output_columns
        
    except Exception as e:
        error_trace = traceback.format_exc()
        return None, f"Execution Error: {str(e)}\n\n{error_trace}", None
    finally:
        if presto_conn:
            try:
                presto_conn.close()
            except:
                pass


def test_function(
    code: str,
    parameters: Dict[str, Any],
    username: str,
    limit_rows: int = 100
) -> Dict[str, Any]:
    """
    Test a function with limited output for sandbox testing.
    
    Returns:
        {
            'success': bool,
            'error': str or None,
            'preview': list of dicts (first N rows),
            'columns': list of column names,
            'output_columns': list of metric column names,
            'row_count': int
        }
    """
    result_df, error, output_columns = execute_function(code, parameters, username)
    
    if error:
        return {
            'success': False,
            'error': error,
            'preview': None,
            'columns': None,
            'output_columns': None,
            'row_count': 0
        }
    
    # Limit preview rows
    preview_df = result_df.head(limit_rows)
    
    return {
        'success': True,
        'error': None,
        'preview': preview_df.to_dict(orient='records'),
        'columns': list(result_df.columns),
        'output_columns': output_columns,
        'row_count': len(result_df)
    }


def join_with_csv(
    csv_df: pd.DataFrame,
    function_result: pd.DataFrame,
    join_columns: List[str] = None
) -> pd.DataFrame:
    """
    Left join the uploaded CSV with function results.
    
    Args:
        csv_df: The uploaded CSV DataFrame
        function_result: The function output DataFrame
        join_columns: Columns to join on (default: ['captain_id', 'yyyymmdd'])
    
    Returns:
        Merged DataFrame
    """
    if join_columns is None:
        join_columns = ['captain_id', 'yyyymmdd']
    
    # Ensure join columns exist in both DataFrames
    for col in join_columns:
        if col not in csv_df.columns:
            raise ValueError(f"CSV is missing join column: {col}")
        if col not in function_result.columns:
            raise ValueError(f"Function result is missing join column: {col}")
    
    # Convert join columns to string for consistent matching
    for col in join_columns:
        csv_df[col] = csv_df[col].astype(str)
        function_result[col] = function_result[col].astype(str)
    
    # Perform left join
    merged = csv_df.merge(
        function_result,
        on=join_columns,
        how='left',
        suffixes=('', '_computed')
    )
    
    return merged


# Example function template for users
FUNCTION_TEMPLATE = '''
def compute_metrics(params):
    """
    Compute metrics at captain_id x yyyymmdd level.
    
    Args:
        params: Dictionary with parameter values
            - start_date: Start date in YYYYMMDD format
            - end_date: End date in YYYYMMDD format
            - (add your custom parameters)
    
    Returns:
        pandas DataFrame with columns:
            - captain_id: Captain identifier
            - yyyymmdd: Date in YYYYMMDD format
            - (your metric columns)
    """
    start_date = params.get('start_date', '20250101')
    end_date = params.get('end_date', '20251231')
    
    # Example SQL query
    query = f"""
    SELECT 
        captain_id,
        yyyymmdd,
        SUM(metric_value) as my_metric
    FROM your_table
    WHERE yyyymmdd BETWEEN '{start_date}' AND '{end_date}'
    GROUP BY captain_id, yyyymmdd
    """
    
    # Execute query using run_query helper
    df = run_query(query)
    
    return df
'''
