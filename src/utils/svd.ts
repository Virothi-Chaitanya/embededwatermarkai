// Simplified SVD for small matrices using power iteration
// For watermarking we only need approximate decomposition

export interface SVDResult {
  U: number[][];
  S: number[];  // diagonal values
  V: number[][];
  rows: number;
  cols: number;
}

function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const n = B[0].length;
  const p = B.length;
  const C: number[][] = [];
  for (let i = 0; i < m; i++) {
    C[i] = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < p; k++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
}

function transpose(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  const T: number[][] = [];
  for (let j = 0; j < n; j++) {
    T[j] = [];
    for (let i = 0; i < m; i++) {
      T[j][i] = A[i][j];
    }
  }
  return T;
}

function vecNorm(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

// Simple SVD via eigendecomposition of A^T*A (power iteration for top-k singular values)
// This is approximate but sufficient for watermarking on small blocks
export function svd(matrix: number[][], k?: number): SVDResult {
  const m = matrix.length;
  const n = matrix[0].length;
  const rank = k || Math.min(m, n);
  
  const At = transpose(matrix);
  const AtA = matMul(At, matrix);
  
  const U: number[][] = [];
  const V: number[][] = [];
  const S: number[] = [];
  
  // Working copy of matrix for deflation
  let current = matrix.map(row => [...row]);
  
  for (let s = 0; s < rank; s++) {
    // Power iteration on current^T * current
    const ct = transpose(current);
    const ctc = matMul(ct, current);
    const dim = ctc.length;
    
    // Random initial vector
    let v = new Array(dim).fill(0).map(() => Math.random() - 0.5);
    let norm = vecNorm(v);
    v = v.map(x => x / norm);
    
    // Power iteration (20 iterations is plenty for convergence)
    for (let iter = 0; iter < 30; iter++) {
      const newV = new Array(dim).fill(0);
      for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
          newV[i] += ctc[i][j] * v[j];
        }
      }
      norm = vecNorm(newV);
      if (norm < 1e-10) break;
      v = newV.map(x => x / norm);
    }
    
    // v is right singular vector
    V.push([...v]);
    
    // sigma * u = A * v
    const u = new Array(m).fill(0);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        u[i] += current[i][j] * v[j];
      }
    }
    const sigma = vecNorm(u);
    S.push(sigma);
    
    if (sigma > 1e-10) {
      const uNorm = u.map(x => x / sigma);
      U.push([...uNorm]);
      
      // Deflate: current = current - sigma * u * v^T
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
          current[i][j] -= sigma * uNorm[i] * v[j];
        }
      }
    } else {
      U.push(new Array(m).fill(0));
    }
  }
  
  // Convert to proper matrix form (U is m x rank, V is rank x n)
  const Umat: number[][] = [];
  for (let i = 0; i < m; i++) {
    Umat[i] = [];
    for (let j = 0; j < rank; j++) {
      Umat[i][j] = U[j] ? U[j][i] : 0;
    }
  }
  
  const Vmat: number[][] = [];
  for (let i = 0; i < rank; i++) {
    Vmat[i] = V[i] ? [...V[i]] : new Array(n).fill(0);
  }
  
  return { U: Umat, S, V: Vmat, rows: m, cols: n };
}

// Reconstruct matrix from SVD
export function svdReconstruct(result: SVDResult): number[][] {
  const { U, S, V, rows, cols } = result;
  const rank = S.length;
  const matrix: number[][] = [];
  
  for (let i = 0; i < rows; i++) {
    matrix[i] = new Array(cols).fill(0);
    for (let k = 0; k < rank; k++) {
      for (let j = 0; j < cols; j++) {
        matrix[i][j] += U[i][k] * S[k] * V[k][j];
      }
    }
  }
  
  return matrix;
}
