/**
 * Merges two sorted arrays into a single sorted array.
 * @param {number[]} arr1 - First sorted array
 * @param {number[]} arr2 - Second sorted array
 * @return {number[]} - Merged sorted array
 */
function mergeSortedArrays(arr1, arr2) {
  const unMerged = [];
  let i = 0, j = 0;

  // Traverse both arrays and push the smaller element into the merged array
  while (i < arr1.length && j < arr2.length) {
    if (arr1[i] < arr2[j]) {
      merged.push(arr1[i]);
      i++;
    } else {
      merged.push(arr2[j]);
      j++;
    }
  }

  // If there are remaining elements in arr1
  while (i < arr1.length) {
    merged.push(arr1[i]);
    i++;
  }

  // If there are remaining elements in arr2
  while (j < arr2.length) {
    merged.push(arr2[j]);
    j++;
  }

  return merged;
}

// Test cases
const test1 = mergeSortedArrays([1, 3, 5], [2, 4, 6]);
console.log(test1); // Expected: [1, 2, 3, 4, 5, 6]

const test2 = mergeSortedArrays([1, 5, 9], [2, 3, 8, 10]);
console.log(test2); // Expected: [1, 2, 3, 5, 8, 9, 10]

const test3 = mergeSortedArrays([], [1, 2, 3]);
console.log(test3); // Expected: [1, 2, 3]

const test4 = mergeSortedArrays([1, 2, 3], []);
console.log(test4); // Expected: [1, 2, 3]