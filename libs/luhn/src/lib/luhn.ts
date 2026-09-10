import { InvalidDictionaryError } from './exceptions.js';

/**
 * @typedef {Object} GenerateResult
 * @property {String} phrase The filtered string
 * @property {String} checksum The generated checksum character
 */

/**
 * @typedef {Object} ValidateResult
 * @property {String} phrase The filtered string
 * @property {Boolean} isValid True if the string is valid
 */

/**
 * Lets you easily generate and validate checksum values based on the Luhn mod-N algorithm
 */
export class Luhn {
  /**
   * Toggle if the class should be case sensitive
   */
  static sensitive = false;

  /**
   * Dictionary that contains all valid characters.
   * Override it if you want to use additional/less characters
   */
  static dictionary =
    '0123456789AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz';

  static lowercaseOnly = (dictionary: string) =>
    dictionary
      .toLowerCase()
      .split('')
      .filter((char, index, arr) => arr.indexOf(char) === index)
      .join('');

  /**
   * Generates a check character for the input string.
   * @param {String} input The string that should have a check character
   * @param {Boolean} sensitive Toggle if the function should be case-sensitive or not.
   * @returns {GenerateResult} The filtered string and checksum character
   *
   * @example
   * Luhn.generate('foo') // -> {phrase: 'foo', checksum: '5'}
   * Luhn.generate('FoO') // -> {phrase: 'foo', checksum: '5'}
   * Luhn.generate('FoO', true) // -> {phrase: 'FoO', checksum: 'n'}
   */
  public static generate(input: string, sensitive?: boolean) {
    const dictionary = sensitive
      ? this.lowercaseOnly(this.dictionary)
      : this.dictionary;

    const n = this.getN(dictionary);
    const filteredArr = (
      sensitive || this.sensitive ? input : input.toLowerCase()
    )
      .split('')
      .filter(this.filterValid(dictionary));

    const sum = [...filteredArr]
      .reverse()
      .reduce(this.reduce(2, dictionary), 0);

    const remainder = sum % n;
    const checkCodePoint = (n - remainder) % n;

    return {
      phrase: filteredArr.join(''),
      checksum: this.index2char(checkCodePoint, dictionary),
    };
  }

  /**
   * Validates if the given string, matches the calculated checksum.
   * The last character in the string is considered the checksum.
   * @param {String} input The string that you want to check,
   * including the check character in the end of the string
   * @param {Boolean} sensitive Toggle if the function should be case-sensitive or not.
   * @returns {ValidateResult} returns if the string is valid or not.
   * @example
   * Luhn.validate('foo5') // -> {phrase: 'foo5', isValid: true}
   * Luhn.validate('FoO5') // -> {phrase: 'foo5', isValid: true}
   * Luhn.validate('FoOö5') // -> {phrase: 'foo5', isValid: true}
   * Luhn.validate('FoO5', true) // -> {phrase: 'FoO5', isValid: false}
   */
  public static validate(input: string, sensitive?: boolean) {
    const dictionary = sensitive
      ? this.lowercaseOnly(this.dictionary)
      : this.dictionary;
    const n = this.getN(dictionary);
    const filteredArr = (
      sensitive || this.sensitive ? input : input.toLowerCase()
    )
      .split('')
      .filter(this.filterValid(dictionary));

    const sum = [...filteredArr]
      .reverse()
      .reduce(this.reduce(1, dictionary), 0);

    return {
      phrase: filteredArr.join(''),
      isValid: !(sum % n),
    };
  }

  /**
   * Looks up an index in the dictionary based on the given character
   * @param {String} character The character you want to find in the dictionary
   * @returns {Number} the index of the character in the dictionary
   */
  protected static readonly char2index = (
    character: string,
    dictionary: string,
  ) => dictionary.indexOf(character);

  /**
   * Looks up a character in the dictionary based on it's index
   * @param {Number} codePoint The index you want to find in the dictionary
   * @returns {String} The character in the dictionary, at the given index
   */
  protected static readonly index2char = (
    codePoint: number,
    dictionary: string,
  ) => dictionary.charAt(codePoint);

  /**
   * Filter out any characters that are not in the dictionary.
   * @param {String} character The character you want to check
   * @returns {Boolean} True if the character is in the dictionary
   */
  protected static readonly filterValid =
    (dictionary: string) => (character: string) =>
      dictionary.indexOf(character) !== -1;

  /**
   * Higher-order function that returns a reducer that calculates the checksum
   * @param {Number}factor
   * @returns {reduce~reducer}
   */
  protected static readonly reduce =
    (factor: 1 | 2, dictionary: string) =>
    /**
     * Reducer function that is applied on an array of
     * characters in order to calculate a checksum.
     * @param {Number} sum current sum of the checksum
     * @param {String} current current character that is being calculated
     * @returns {Number} the checksum
     */
    (sum: number, current: string) => {
      const codePoint = this.char2index(current, dictionary);
      let addend = factor * codePoint;

      factor = factor === 2 ? 1 : 2;

      addend =
        Math.floor(addend / dictionary.length) + (addend % dictionary.length);
      return (sum += addend);
    };

  /**
   * Checks that the dictionary complies with the requirements,
   * and returns the N value.
   * @returns {Number} Length of the dictionary
   */
  protected static readonly getN = (dictionary: string) => {
    if (dictionary.length % 2 !== 0) {
      throw new InvalidDictionaryError(dictionary);
    }

    return dictionary.length;
  };
}
