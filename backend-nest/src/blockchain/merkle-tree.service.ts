import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class MerkleTreeService {
  /**
   * Build a Merkle tree and return the root hash
   */
  buildTree(hashes: string[]): string {
    if (hashes.length === 0) {
      return this.hash('');
    }

    if (hashes.length === 1) {
      return hashes[0];
    }

    let currentLevel = [...hashes];

    // Ensure even number of nodes
    if (currentLevel.length % 2 !== 0) {
      currentLevel.push(currentLevel[currentLevel.length - 1]);
    }

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const combined = currentLevel[i] + currentLevel[i + 1];
        nextLevel.push(this.hash(combined));
      }

      currentLevel = nextLevel;

      // Ensure even number of nodes for next iteration
      if (currentLevel.length > 1 && currentLevel.length % 2 !== 0) {
        currentLevel.push(currentLevel[currentLevel.length - 1]);
      }
    }

    return currentLevel[0];
  }

  /**
   * Get Merkle proof for a leaf at given index
   */
  getProof(hashes: string[], index: number): string[] {
    if (hashes.length === 0 || index >= hashes.length) {
      return [];
    }

    const proof: string[] = [];
    let currentIndex = index;
    let currentLevel = [...hashes];

    // Ensure even number of nodes
    if (currentLevel.length % 2 !== 0) {
      currentLevel.push(currentLevel[currentLevel.length - 1]);
    }

    while (currentLevel.length > 1) {
      // Determine sibling index
      const siblingIndex =
        currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;

      // Add sibling to proof with direction indicator
      const direction = currentIndex % 2 === 0 ? 'R' : 'L';
      proof.push(`${direction}:${currentLevel[siblingIndex]}`);

      // Calculate next level
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const combined = currentLevel[i] + currentLevel[i + 1];
        nextLevel.push(this.hash(combined));
      }

      // Update index for next level
      currentIndex = Math.floor(currentIndex / 2);
      currentLevel = nextLevel;

      // Ensure even number
      if (currentLevel.length > 1 && currentLevel.length % 2 !== 0) {
        currentLevel.push(currentLevel[currentLevel.length - 1]);
      }
    }

    return proof;
  }

  /**
   * Verify a Merkle proof
   */
  verifyProof(leafHash: string, proof: string[], root: string): boolean {
    let currentHash = leafHash;

    for (const step of proof) {
      const [direction, siblingHash] = step.split(':');

      if (direction === 'L') {
        currentHash = this.hash(siblingHash + currentHash);
      } else {
        currentHash = this.hash(currentHash + siblingHash);
      }
    }

    return currentHash === root;
  }

  /**
   * Hash a string using SHA256
   */
  private hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Build tree structure for visualization
   */
  buildTreeStructure(hashes: string[]): {
    root: string;
    levels: string[][];
  } {
    if (hashes.length === 0) {
      return { root: this.hash(''), levels: [[this.hash('')]] };
    }

    const levels: string[][] = [];
    let currentLevel = [...hashes];
    levels.push([...currentLevel]);

    // Ensure even number
    if (currentLevel.length % 2 !== 0) {
      currentLevel.push(currentLevel[currentLevel.length - 1]);
    }

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const combined = currentLevel[i] + currentLevel[i + 1];
        nextLevel.push(this.hash(combined));
      }

      currentLevel = nextLevel;
      levels.push([...currentLevel]);

      if (currentLevel.length > 1 && currentLevel.length % 2 !== 0) {
        currentLevel.push(currentLevel[currentLevel.length - 1]);
      }
    }

    return {
      root: currentLevel[0],
      levels: levels.reverse(), // Root at top
    };
  }
}
